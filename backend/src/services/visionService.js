'use strict';

const path = require('node:path');
const { Worker } = require('node:worker_threads');

const WORKER_PATH = path.join(__dirname, 'visionWorker.js');
const TAM = 224;

const entero = (valor, porDefecto, minimo = 1) => {
  const n = Number(valor);
  return Number.isInteger(n) && n >= minimo ? n : porDefecto;
};
const timeoutMs = () => {
  const n = Number(process.env.VISION_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 30000;
};

const visionHabilitada = () => process.env.VISION_ENABLED !== 'false';
const fallo = (error_code, mensaje) => ({ ok: false, error_code, mensaje });

async function preprocesarImagen(rutaFoto) {
  const sharp = require('sharp');
  const { data, info } = await sharp(rutaFoto, { limitInputPixels: 50_000_000 })
    .resize(TAM, TAM, { fit: 'cover' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== TAM || info.height !== TAM || info.channels !== 3 || data.length !== TAM * TAM * 3) {
    throw new Error(`Formato de píxeles inesperado.`);
  }
  return { pixeles: data, width: info.width, height: info.height };
}

const dependencias = {
  preprocesar: preprocesarImagen,
  crearWorker: () => new Worker(WORKER_PATH),
};

let worker = null;
let secuencia = 0;

function obtenerWorker() {
  if (worker) return worker;
  const w = dependencias.crearWorker();
  w.on('error', (error) => console.error('[VisionService] Error en el hilo de IA:', error?.message ?? error));
  w.once('exit', () => { if (worker === w) worker = null; });
  if (typeof w.unref === 'function') w.unref();
  worker = w;
  return w;
}

function descartarWorker(w) {
  if (worker === w) worker = null;
  try { Promise.resolve(w.terminate()).catch(() => {}); } catch { }
}

function precalentar() {
  if (!visionHabilitada()) return false;
  try { obtenerWorker(); return true; } catch (error) { return false; }
}

function ejecutarEnWorker(pre, limiteMs) {
  return new Promise((resolve) => {
    let w;
    try { w = obtenerWorker(); } catch (error) {
      return resolve(fallo('VISION_WORKER_CAIDO', 'No se pudo iniciar el hilo de IA.'));
    }

    const id = ++secuencia;
    let timer = null;
    let terminado = false;

    const terminar = (resultado, descartar) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      w.off('message', alMensaje);
      w.off('error', alError);
      w.off('exit', alSalir);
      if (descartar) descartarWorker(w);
      resolve(resultado);
    };

    function alMensaje(respuesta) {
      if (!respuesta || respuesta.id !== id) return;
      if (respuesta.ok) return terminar({ ok: true, analisis: respuesta.analisis }, false);
      return terminar(fallo('VISION_WORKER_ERROR', 'El modelo local falló.'), false);
    }
    function alError(error) { terminar(fallo('VISION_WORKER_CAIDO', 'Fallo crítico.'), true); }
    function alSalir(codigo) { terminar(fallo('VISION_WORKER_CAIDO', 'Fallo crítico.'), true); }

    timer = setTimeout(() => terminar(fallo('VISION_TIMEOUT', 'Timeout.'), true), limiteMs);

    w.on('message', alMensaje);
    w.on('error', alError);
    w.on('exit', alSalir);
    w.postMessage({ id, pixeles: pre.pixeles, width: pre.width, height: pre.height });
  });
}

function conLimite(promesa, ms) {
  let timer;
  const limite = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { codigo: 'VISION_TIMEOUT' })), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

async function analizar(rutaFoto) {
  try {
    const total = timeoutMs();
    const inicio = Date.now();
    let pre;
    try {
      pre = await conLimite(Promise.resolve().then(() => dependencias.preprocesar(rutaFoto)), total);
    } catch (error) {
      if (error?.codigo === 'VISION_TIMEOUT') return fallo('VISION_TIMEOUT', 'El análisis visual tardó demasiado.');
      return fallo('VISION_PREPROCESO_FALLO', 'No se pudo procesar la foto.');
    }
    return await ejecutarEnWorker(pre, Math.max(1, total - (Date.now() - inicio)));
  } catch (error) {
    return fallo('VISION_WORKER_ERROR', 'El modelo local falló.');
  }
}

let cola = Promise.resolve();
let enCola = 0;

function analyzeImage(rutaFoto) {
  if (!visionHabilitada()) return Promise.resolve(fallo('VISION_DESHABILITADA', 'Módulo de visión apagado.'));
  if (enCola >= entero(process.env.VISION_MAX_COLA, 20)) return Promise.resolve(fallo('VISION_SATURADO', 'Saturado.'));

  enCola += 1;
  const tarea = cola.then(() => analizar(rutaFoto)).finally(() => { enCola -= 1; });
  cola = tarea.catch(() => {});
  return tarea;
}

module.exports = { analyzeImage, visionHabilitada, precalentar };