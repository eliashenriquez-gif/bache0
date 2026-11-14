#!/usr/bin/env node
/**
 * Bache0 - Importador reproducible de 45 reportes ficticios.
 * Node.js >= 20, sin dependencias extras. No altera backend ni modelo.
 * La API resuelve la municipalidad a partir de coordenadas con Nominatim.
 * No utiliza ni copia máscaras de referencia como fotos.
 * Los resultados locales permiten reanudar sin duplicar reportes.
 *
 * Ejemplos:
 *   node backend/scripts/importar-demo45.mjs --solo-verificar
 *   node backend/scripts/importar-demo45.mjs --grupo desarrollo --limite 1
 *   node backend/scripts/importar-demo45.mjs --grupo desarrollo
 *   node backend/scripts/importar-demo45.mjs --grupo reserva
 *   node backend/scripts/importar-demo45.mjs --estado
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/demo-vision-45');
const stateDir = path.resolve(base, '../../var/demo-vision-45');
const statePath = path.join(stateDir, 'resultados_importacion.jsonl');
const baseUrl = String(process.env.BACHE0_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const args = process.argv.slice(2);
const includes = (name) => args.includes(name);
function option(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i+1] : fallback;
}
function fail(message) { console.error('ERROR:', message); process.exitCode = 1; }
function asInt(v, name, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw Error(`${name} debe ser entero entre ${min} y ${max}`);
  return n;
}
// Maneja comillas, comas interiores y saltos de línea en celdas CSV.
function parseCsv(s) {
  const rows=[]; let row=[], cell='', quoted=false;
  for (let i=0; i<s.length; i++) {
    const c=s[i];
    if (c==='"') {
      if (quoted && s[i+1]==='"') { cell+='"'; i++; }
      else quoted=!quoted;
    } else if (c===',' && !quoted) { row.push(cell); cell=''; }
    else if ((c==='\n'||c==='\r') && !quoted) {
      if (c==='\r' && s[i+1]==='\n') i++;
      row.push(cell); if (row.some(x=>x!=='')) rows.push(row);
      row=[]; cell='';
    } else cell+=c;
  }
  if (quoted) throw Error('CSV tiene comillas sin cerrar');
  row.push(cell); if (row.some(x=>x!=='')) rows.push(row);
  const [headers,...values]=rows;
  if (!headers) throw Error('CSV vacío');
  for (const r of values) if (r.length!==headers.length) throw Error('CSV inconsistente');
  return values.map(v=>Object.fromEntries(headers.map((h,i)=>[h.replace(/^\uFEFF/,''),v[i]])));
}
const points={
  1:{lat:-33.460200,lon:-70.698100,nombre:'Estación Central'},
  2:{lat:-33.582800,lon:-70.634600,nombre:'La Pintana'},
  3:{lat:-33.578500,lon:-70.672000,nombre:'El Bosque'},
};
function coords(row) {
  const p=points[Number(row.municipalidad_id_demostracion)];
  if (!p || p.nombre!==row.municipalidad_demostracion) throw Error(`Municipalidad desconocida: ${row.id_bache0}`);
  // Posiciones artificiales a pocos metros de los puntos demostrativos de db/seed.sql.
  // Nunca se presentan como daños reales en esas calles.
  const n=Number(row.numero_reporte_demostracion)-1;
  return {lat:(p.lat+((n%5)-2)*0.00025).toFixed(6),lon:(p.lon+(Math.floor(n/5)-1)*0.00025).toFixed(6)};
}
function sha(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function nap(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function retryWait(raw) {
  const secs=Number(raw);
  return Number.isFinite(secs) && secs>=0 ? Math.ceil(secs*1000) : 60000;
}
async function loadCompleted() {
  if (!fs.existsSync(statePath)) return new Map();
  const m=new Map();
  for(const line of (await fsp.readFile(statePath,'utf8')).split(/\r?\n/).filter(Boolean)) {
    const r=JSON.parse(line); if(r.id_bache0 && r.reporte_id) m.set(r.id_bache0,r);
  }
  return m;
}
async function main() {
  const grupo=option('--grupo','desarrollo');
  if (!['desarrollo','reserva','todas'].includes(grupo)) throw Error('Usar --grupo desarrollo|reserva|todas');
  const limite=asInt(option('--limite','45'),'--limite',1,45);
  const delay=asInt(option('--delay-ms','1500'),'--delay-ms',1000,600000);
  const csv=await fsp.readFile(path.join(base,'manifiesto_originales_45.csv'),'utf8');
  const rows=parseCsv(csv);
  if(rows.length!==45) throw Error(`El manifiesto tiene ${rows.length} filas y debe tener 45`);
  const ids=new Set();
  const counts={1:0,2:0,3:0};const parts={DESARROLLO_DEMO:0,RESERVA_FINAL_SIN_AJUSTE:0};
  for(const r of rows) {
    if(ids.has(r.id_bache0)) throw Error(`ID duplicado ${r.id_bache0}`);
    ids.add(r.id_bache0); counts[Number(r.municipalidad_id_demostracion)]++;
    if(!(r.particion_experimento in parts)) throw Error('Partición desconocida');
    parts[r.particion_experimento]++;
    coords(r);
    for(const [dir,name,expected] of [
      ['imagenes_originales',r.nombre_original_imagen,r.sha256_imagen_original],
      ['mascaras_originales',r.nombre_original_mascara,r.sha256_mascara_original],
    ]) {
      if(path.basename(name)!==name) throw Error(`Nombre inseguro ${name}`);
      const bytes=await fsp.readFile(path.join(base,dir,name));
      if(sha(bytes)!==expected) throw Error(`SHA-256 no coincide para ${r.id_bache0} ${name}`);
      if(dir==='imagenes_originales' && bytes.length>10*1024*1024) throw Error(`Foto excede 10MiB: ${name}`);
    }
  }
  if (Object.values(counts).some(n=>n!==15) || parts.DESARROLLO_DEMO!==30 || parts.RESERVA_FINAL_SIN_AJUSTE!==15)
    throw Error('Distribución 15/15/15 y particiones 30/15 incorrectas');
  console.log('Verificación local: 45 JPG + 45 máscaras, SHA-256 OK, 15 por comuna, 30 desarrollo y 15 reserva.');
  const completed=await loadCompleted();
  console.log('Reportes ya registrados en este equipo:',completed.size,'| control:',statePath);
  if(includes('--solo-verificar') || includes('--estado')) return;
  if(!/^https?:\/\//.test(baseUrl)) throw Error('BACHE0_API_URL no es URL válida');
  const selected=rows.filter(r=>grupo==='todas'||r.particion_experimento===(grupo==='desarrollo'?'DESARROLLO_DEMO':'RESERVA_FINAL_SIN_AJUSTE'));
  let sent=0;
  for(const row of selected) {
    if(completed.has(row.id_bache0)) {console.log('Ya existe (omitir):',row.id_bache0,'#',completed.get(row.id_bache0).reporte_id);continue;}
    if(sent>=limite) break;
    const {lat,lon}=coords(row);
    const bytes=await fsp.readFile(path.join(base,'imagenes_originales',row.nombre_original_imagen));
    const form=new FormData();
    form.set('latitud',lat); form.set('longitud',lon);
    form.set('metodo_ubicacion','pin_manual'); form.set('ubicacion_confirmada','true');
    form.set('severidad',['baja','media','alta'][(Number(row.numero_reporte_demostracion)-1)%3]);
    form.set('concurrencia_vial','media'); form.set('infraestructura_critica','ninguna');
    form.set('descripcion',`DEMO45 ${row.id_bache0} | NO ES REPORTE REAL | Foto dataset PavementDamagesG-7, Colombia | Coordenadas ficticias para demo municipal ${row.municipalidad_demostracion}.`);
    form.set('foto', new Blob([bytes],{type:'image/jpeg'}), row.nombre_original_imagen);
    let res,body;
    for(let attempt=1;attempt<=4;attempt++) {
      res=await fetch(`${baseUrl}/reportes`,{method:'POST',body:form,signal:AbortSignal.timeout(120000)});
      const content=await res.text(); try {body=JSON.parse(content)} catch{body={raw:content.slice(0,500)}};
      if(res.status!==429) break;
      if(attempt===4) throw Error('429 repetido: detener y retomar cuando corresponda');
      const wait=retryWait(res.headers.get('Retry-After'));
      console.log(`429 RATE_LIMIT, respetando Retry-After para ${row.id_bache0}.`);
      await nap(wait);
    }
    if(res.status!==201) {
      console.error(`FALLÓ ${row.id_bache0} HTTP ${res.status}:`,JSON.stringify(body).slice(0,1200));
      throw Error('Importación detenida. Corregir y reanudar; no borrar el registro de estado.');
    }
    const created=body?.data ?? body;
    const id=created?.id, muni=Number(created?.municipalidad_id);
    if(!Number.isInteger(Number(id))||Number(id)<=0) throw Error(`HTTP 201 sin ID de reporte para ${row.id_bache0}. Revisar la BD ANTES de reintentar.`);
    const record={id_bache0:row.id_bache0,reporte_id:Number(id),folio:created.folio||null,
      municipalidad_id_esperada:Number(row.municipalidad_id_demostracion),municipalidad_id_respuesta:muni,
      foto_original:row.nombre_original_imagen,foto_sha256:row.sha256_imagen_original,
      particion_experimento:row.particion_experimento,fecha_importacion:new Date().toISOString()};
    await fsp.mkdir(stateDir,{recursive:true});
    await fsp.appendFile(statePath,JSON.stringify(record)+'\n','utf8');
    completed.set(row.id_bache0,record);
    if(muni!==record.municipalidad_id_esperada) throw Error(`ALERTA: ${row.id_bache0} se guardó en comuna ${muni}, se esperaba ${record.municipalidad_id_esperada}. No continuar.`);
    sent++;
    console.log(`OK ${row.id_bache0} → reporte ${id}, folio ${record.folio||'no informado'}, municipio ${muni}`);
    await nap(delay);
  }
  console.log(`Completado este lote: ${sent} nuevos. Registro local: ${statePath}`);
}
main().catch(err=>fail(err.message));
