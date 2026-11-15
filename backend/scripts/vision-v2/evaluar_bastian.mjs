#!/usr/bin/env node
/*
 * Ensayo EXCLUSIVAMENTE local del modelo actual de Bastián.
 * No usa Express, API, PostgreSQL ni llamadas de red.
 * No altera modelo, configuración, prioridad o registros existentes.
 * El modo por defecto ejecuta únicamente el grupo DESARROLLO (30 fotografías).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { calcularMetricas, barridoUmbrales } from './metricas.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const lista = JSON.parse(fs.readFileSync(path.join(__dirname, 'casos_45.json'), 'utf8'));

function opcionesCLI() {
  const args = process.argv.slice(2);
  const o = { grupo: 'desarrollo', limite: Infinity, ids: null, soloVerificar: false, autorizarReserva: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--grupo') o.grupo = args[++i];
    else if (a === '--limite') o.limite = Number(args[++i]);
    else if (a === '--ids') o.ids = (args[++i] || '').split(',').map((x) => x.trim()).filter(Boolean);
    else if (a === '--solo-verificar') o.soloVerificar = true;
    else if (a === '--autorizar-evaluacion-final') o.autorizarReserva = true;
    else throw new Error(`Opción desconocida: ${a}`);
  }
  if (!['desarrollo', 'reserva'].includes(o.grupo)) throw new Error('Usa --grupo desarrollo o reserva.');
  if (!(o.limite === Infinity || (Number.isSafeInteger(o.limite) && o.limite >= 1))) throw new Error('--limite inválido.');
  if (!o.soloVerificar && o.grupo === 'reserva' && !o.autorizarReserva) {
    throw new Error('La reserva está protegida: ejecuta SOLO una vez, al cerrar ajustes, usando --autorizar-evaluacion-final.');
  }
  return o;
}

function verificarArchivo(ruta, shaEsperado) {
  if (!fs.existsSync(ruta)) throw new Error(`Falta el archivo: ${ruta}`);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');
  if (sha !== shaEsperado) throw new Error(`SHA-256 no coincide: ${ruta}`);
}
function toCSV(filas) {
  if (!filas.length) return '';
  const campos = Object.keys(filas[0]);
  const escapeCSV = (v) => `"${String(v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v).replaceAll('"', '""')}"`;
  return [campos.map(escapeCSV).join(','), ...filas.map((r) => campos.map((k) => escapeCSV(r[k])).join(','))].join('\r\n') + '\r\n';
}

async function main() {
  const o = opcionesCLI();
  const todas = lista.filter((r) => r.grupo === o.grupo);
  let seleccion = todas;
  if (o.ids) {
    const nombres = new Set(o.ids);
    seleccion = seleccion.filter((r) => nombres.has(r.id));
    if (seleccion.length !== nombres.size) throw new Error('Uno o más --ids no pertenecen al grupo elegido o no existen.');
  }
  seleccion = seleccion.slice(0, o.limite);
  if (!seleccion.length) throw new Error('No hay casos para evaluar.');
  console.log(`Grupo ${o.grupo}: ${seleccion.length} imágenes · ${seleccion.filter((c) => c.bache_anotado).length} con bache anotado`);
  for (const caso of seleccion) {
    verificarArchivo(path.join(backend, caso.ruta_imagen), caso.sha256_imagen);
    verificarArchivo(path.join(backend, caso.ruta_mascara), caso.sha256_mascara);
  }
  console.log('Fotografías y máscaras: SHA-256 verificado (coinciden con el manifiesto).');
  if (o.soloVerificar) return;

  // Importar visión SOLO después de validar todo, para que --solo-verificar no requiera dependencias de TensorFlow.
  const { analyzeImage, cerrarVision } = require('../../src/services/visionService.js');
  const filas = [];
  try {
    for (const caso of seleccion) {
      const inicio = performance.now();
      const r = await analyzeImage(path.join(backend, caso.ruta_imagen));
      const latencia_ms = Math.round(performance.now() - inicio);
      let fila = {
        id: caso.id, grupo: caso.grupo, municipalidad_demo: caso.municipalidad_demo,
        nombre_imagen_original: caso.nombre_imagen_original, etiquetas_referencia: caso.etiquetas,
        bache_real: caso.bache_anotado, estado: r.ok ? 'OK' : 'ERROR',
        bache_predicho: null, clase_predicha: null, confianza_predicha: null,
        puntaje_bache: null, version_modelo: null, latencia_ms, error: '',
      };
      if (!r.ok) fila.error = `${r.error_code}: ${r.mensaje}`;
      else {
        const analisis = r.analisis;
        const detecciones = analisis.detecciones || [];
        const bache = detecciones.find((d) => d.clase_modelo?.toLowerCase() === 'bache');
        fila = {
          ...fila,
          bache_predicho: analisis.tipo_desperfecto === 'bache',
          clase_predicha: detecciones[0]?.clase_modelo ?? analisis.tipo_desperfecto,
          confianza_predicha: analisis.confianza,
          puntaje_bache: bache?.confianza ?? null,
          version_modelo: analisis.version_modelo ?? null,
        };
      }
      filas.push(fila);
      console.log(`${caso.id}: ${fila.estado} · referencia=${caso.bache_anotado ? 'bache' : 'sin bache'} · modelo=${fila.clase_predicha ?? fila.error} · ${latencia_ms} ms`);
    }
  } finally {
    await cerrarVision();
  }
  const carpeta = path.join(__dirname, 'resultados');
  fs.mkdirSync(carpeta, { recursive: true });
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const raiz = `bastian_${o.grupo}_${marca}`;
  fs.writeFileSync(path.join(carpeta, `${raiz}.csv`), toCSV(filas));
  fs.writeFileSync(path.join(carpeta, `${raiz}.json`), JSON.stringify(filas, null, 2));
  const metricas = calcularMetricas(filas);
  fs.writeFileSync(path.join(carpeta, `${raiz}_resumen.json`), JSON.stringify(metricas, null, 2));
  if (o.grupo === 'desarrollo') {
    const umbrales = barridoUmbrales(filas);
    fs.writeFileSync(path.join(carpeta, `${raiz}_umbrales_exploratorios.json`), JSON.stringify(umbrales, null, 2));
  }
  console.log('\nRESUMEN:', JSON.stringify(metricas, null, 2));
  console.log(`Resultados: ${carpeta} (ignorados por Git)`);
  if (metricas.fallidas) {
    console.error('ATENCIÓN: hubo errores de inferencia; no interpretar estos datos como evaluación completa.');
    process.exitCode = 2;
  }
}
main().catch((error) => { console.error('ERROR:', error.message); process.exitCode = 1; });
