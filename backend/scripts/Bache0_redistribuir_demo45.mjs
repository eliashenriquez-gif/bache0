#!/usr/bin/env node
/**
 * Bache0 - Redistribución controlada de datos DEMO45, no modifica reportes ciudadanos.
 * Copiar a backend/scripts/redistribuir-demo45.mjs y ejecutar desde la raíz:
 *   node backend/scripts/redistribuir-demo45.mjs --preparar
 *   node backend/scripts/redistribuir-demo45.mjs --aplicar
 *
 * --preparar: solo consultas, sin UPDATE. Descarga límites comunales GeoJSON de ArcGIS/INE.
 * --aplicar: actualiza exactamente 45 filas con transacción/auditoría después de revisar CSV.
 * No altera fotos, folios, municipalidad, análisis de IA, severidad ni prioridad.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = path.join(root, 'var/demo-vision-45');
const statePath = path.join(stateDir, 'resultados_importacion.jsonl');
const planPath = path.join(stateDir, 'redistribucion_plan.json');
const csvPath = path.join(stateDir, 'redistribucion_previa.csv');
const { pool } = await import('../src/config/database.js');
const { insertAuditEvent } = await import('../src/repositories/auditRepository.js');
// Códigos CUT del INE: capa polígonos comunales publicada por OCUC/INE (2026-04-30).
const zones = {
  1: { name: 'Estación Central', cut: 13106 },
  2: { name: 'La Pintana', cut: 13112 },
  3: { name: 'El Bosque', cut: 13105 },
};
const GEO_URL='https://services9.arcgis.com/kKJR3Qt68ohAWuet/ArcGIS/rest/services/Comunas_de_Chile/FeatureServer/0/query';
function halton(n, base) { let f=1, r=0; while (n>0) { f/=base; r+=f*(n%base); n=Math.floor(n/base); } return r; }
function distanceMeters(a,b) {
  const dy=(a.latitud-b.latitud)*111200;
  const dx=(a.longitud-b.longitud)*111200*Math.cos(a.latitud*Math.PI/180);
  return Math.hypot(dx,dy);
}
function inRing(x,y,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if(((a[1]>y)!==(b[1]>y)) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function inGeometry(lon,lat,geom) {
  if(!geom) return false;
  const polys=geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];
  return polys.some(p=>inRing(lon,lat,p[0])&&!p.slice(1).some(hole=>inRing(lon,lat,hole)));
}
function withinInterior(lon,lat,geom) {
  // Evitar puntos en límites: exige un pequeño margen en todas las direcciones.
  return [[0,0],[0.002,0],[-0.002,0],[0,0.0025],[0,-0.0025]]
    .every(([dy,dx])=>inGeometry(lon+dx,lat+dy,geom));
}
async function communePolygons() {
  const q=new URLSearchParams({where:'cut IN (13105,13106,13112)',
    outFields:'cut,comuna',outSR:'4326',f:'geojson'});
  const url=GEO_URL+'?'+q;
  const res=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!res.ok) throw Error(`No se pudo obtener capa oficial de comunas (HTTP ${res.status}).`);
  const data=await res.json();
  if(data?.error || !Array.isArray(data?.features)) throw Error('Fuente cartográfica no entregó GeoJSON válido.');
  const features=new Map(data.features.map(f=>[Number(f.properties?.cut),f]));
  for(const z of Object.values(zones)) {
    const f=features.get(z.cut);
    if(!f?.geometry || !String(f.properties?.comuna||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(z.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))
      throw Error(`Polígono o nombre inesperado para ${z.name}; no se modifica ningún dato.`);
  }
  return features;
}
function bounds(geom) {
  const list=[];
  function walk(a) { if(Array.isArray(a) && typeof a[0]==='number' && typeof a[1]==='number') list.push(a);
    else if(Array.isArray(a)) for(const b of a) walk(b); }
  walk(geom.coordinates);
  if(list.length<4) throw Error('Geometría municipal no válida.');
  const b={west:Infinity,east:-Infinity,south:Infinity,north:-Infinity};
  for(const [lon,lat] of list) {b.west=Math.min(b.west,lon);b.east=Math.max(b.east,lon);
    b.south=Math.min(b.south,lat);b.north=Math.max(b.north,lat);}
  return b;
}
const FIELDS=['id','folio','municipalidad_id','descripcion','latitud','longitud',
  'direccion_detectada','calle_detectada','comuna_detectada','region_detectada',
  'estado_geocodificacion','geocodificacion_proveedor'];
function snapshot(r) { return Object.fromEntries(FIELDS.map(k=>[k,r[k] ?? null])); }
function csvCell(v) { const s=String(v??''); return /[,"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s; }
async function loadState() {
  const lines=(await fs.readFile(statePath,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const m=new Map();
  for(const r of lines) {
    if(m.has(r.id_bache0)) throw Error(`ID de importación duplicado: ${r.id_bache0}`);
    if(!Number.isInteger(r.reporte_id) || ![1,2,3].includes(r.municipalidad_id_esperada))
      throw Error('Archivo de control inválido.');
    m.set(r.id_bache0,r);
  }
  if(m.size!==45) throw Error(`Se requieren exactamente 45 registros en control; hay ${m.size}.`);
  for(const mid of [1,2,3]) if([...m.values()].filter(r=>r.municipalidad_id_esperada===mid).length!==15)
    throw Error(`No hay 15 registros para municipalidad ${mid}.`);
  if(new Set([...m.values()].map(r=>r.reporte_id)).size!==45) throw Error('IDs de reportes duplicados.');
  return [...m.values()].sort((a,b)=>a.municipalidad_id_esperada-b.municipalidad_id_esperada || a.id_bache0.localeCompare(b.id_bache0));
}
async function loadRows(entries, client=pool, lock=false) {
  const ids=entries.map(e=>e.reporte_id);
  const {rows}=await client.query(`SELECT ${FIELDS.join(', ')} FROM reportes WHERE id=ANY($1::int[]) ORDER BY id ${lock?'FOR UPDATE':''}`,[ids]);
  if(rows.length!==45) throw Error(`PostgreSQL devolvió ${rows.length}/45 reportes esperados. Sin cambios.`);
  const byId=new Map(rows.map(r=>[r.id,r]));
  for(const e of entries) {
    const r=byId.get(e.reporte_id);
    if(r?.municipalidad_id!==e.municipalidad_id_esperada ||
      !String(r.descripcion||'').startsWith(`DEMO45 ${e.id_bache0} | NO ES REPORTE REAL`))
      throw Error(`Validación de DEMO45 fallida para ${e.id_bache0}; no se modifica.`);
  }
  return byId;
}
async function prepare() {
  const db=await pool.query('SELECT current_database() AS db');
  if(db.rows[0].db!=='bache0_dev') throw Error('Se requiere la base local bache0_dev; no se hará nada.');
  const entries=await loadState();
  const rows=await loadRows(entries);
  const afterByMid=new Map();
  const polygons=await communePolygons();
  for(const mid of [1,2,3]) {
    const z=zones[mid], selected=[];
    const geo=polygons.get(z.cut).geometry, b=bounds(geo);
    // Selección determinista DISPERSA dentro del polígono INE, sin geocodificación
    // inversa ni consulta sistemática a Nominatim. Son puntos ficticios, no calles.
    for(let i=1; i<=900 && selected.length<15; i++) {
      const latitud=Number((b.south+(b.north-b.south)*halton(i+mid*17,2)).toFixed(6));
      const longitud=Number((b.west+(b.east-b.west)*halton(i+mid*17,3)).toFixed(6));
      if(!withinInterior(longitud,latitud,geo)) continue;
      const p={latitud,longitud};
      if(selected.some(other=>distanceMeters(p,other)<430)) continue;
      const num=String(selected.length+1).padStart(2,'0');
      selected.push({...p,
        direccion_detectada:`Punto ficticio DEMO45, sector ${num}, ${z.name}, Chile`,
        calle_detectada:null, estado_geocodificacion:'parcial'});
      console.log(`${z.name}: ${selected.length}/15 coordenadas dentro del polígono INE`);
    }
    if(selected.length!==15) throw Error(`Solo ${selected.length}/15 ubicaciones válidas dentro de ${z.name}. Sin cambios en PostgreSQL.`);
    afterByMid.set(mid,selected);
  }
  const cursors={1:0,2:0,3:0};
  const plan={version:1, createdAt:new Date().toISOString(), targetDb:'bache0_dev',source:'OCUC/INE comunas Chile 2026-04-30 (ArcGIS)',rows:entries.map(e=>{
    const old=snapshot(rows.get(e.reporte_id));
    return {id_bache0:e.id_bache0, reporte_id:e.reporte_id, municipalidad_id:e.municipalidad_id_esperada,
      before:old, after:afterByMid.get(e.municipalidad_id_esperada)[cursors[e.municipalidad_id_esperada]++]};
  })};
  await fs.mkdir(stateDir,{recursive:true});
  await fs.writeFile(planPath,JSON.stringify(plan,null,2)+'\n');
  const headers=['id_bache0','reporte_id','comuna','latitud_anterior','longitud_anterior','latitud_nueva','longitud_nueva','calle_nueva','direccion_nueva'];
  const csv=[headers.join(',')];
  for(const r of plan.rows) csv.push([
    r.id_bache0,r.reporte_id,zones[r.municipalidad_id].name,r.before.latitud,r.before.longitud,
    r.after.latitud,r.after.longitud,r.after.calle_detectada,r.after.direccion_detectada,
  ].map(csvCell).join(','));
  await fs.writeFile(csvPath,'\uFEFF'+csv.join('\r\n')+'\r\n');
  console.log('\nPREVISUALIZACIÓN GENERADA; BASE DE DATOS SIN CAMBIOS.');
  console.log('CSV:',csvPath);
  console.log('Plan:',planPath);
  console.log('Revisar CSV antes de ejecutar --aplicar.');
}
async function apply() {
  const db=await pool.query('SELECT current_database() AS db');
  if(db.rows[0].db!=='bache0_dev') throw Error('Se requiere la base local bache0_dev; no se hará nada.');
  const entries=await loadState();
  const plan=JSON.parse(await fs.readFile(planPath,'utf8'));
  if(plan.version!==1 || plan.rows?.length!==45) throw Error('Plan ausente, incompleto o inválido.');
  if(Date.now()-Date.parse(plan.createdAt)>48*3600000) throw Error('Plan tiene más de 48 horas. Regenerar con --preparar.');
  const byEntry=new Map(entries.map(e=>[e.reporte_id,e]));
  if(new Set(plan.rows.map(r=>r.reporte_id)).size!==45) throw Error('Plan con IDs duplicados.');
  for(const r of plan.rows) {
    const e=byEntry.get(r.reporte_id);
    if(!e || e.id_bache0!==r.id_bache0 || e.municipalidad_id_esperada!==r.municipalidad_id)
      throw Error('Plan no coincide con control de importación.');
    if(!r.after || !Number.isFinite(r.after.latitud) || !Number.isFinite(r.after.longitud) ||
      !r.after.direccion_detectada) throw Error('Plan con ubicación incompleta.');
  }
  // Comprobar nuevamente límites, distancia y cantidad antes de comenzar la transacción.
  const polygons=await communePolygons();
  for(const mid of [1,2,3]) {
    const rows=plan.rows.filter(r=>r.municipalidad_id===mid);
    if(rows.length!==15) throw Error(`Plan no contiene 15 reportes en comuna ${mid}.`);
    const geo=polygons.get(zones[mid].cut).geometry;
    for(const r of rows) {
      if(!withinInterior(r.after.longitud,r.after.latitud,geo))
        throw Error(`Ubicación fuera del polígono de ${zones[mid].name}: ${r.reporte_id}`);
      if(rows.some(s=>s!==r && distanceMeters(r.after,s.after)<430))
        throw Error(`Dos ubicaciones demasiado próximas en ${zones[mid].name}.`);
    }
  }
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const current=await loadRows(entries,client,true);
    for(const r of plan.rows) {
      if(JSON.stringify(snapshot(current.get(r.reporte_id)))!==JSON.stringify(r.before))
        throw Error(`El reporte ${r.reporte_id} cambió desde la previsualización. Se cancela todo.`);
      const a=r.after;
      const result=await client.query(`UPDATE reportes SET latitud=$2, longitud=$3,
        direccion_detectada=$4, calle_detectada=$5,
        estado_geocodificacion=$6, geocodificacion_proveedor='ine-poligonos-demo',
        geocodificacion_resuelta_at=clock_timestamp()
        WHERE id=$1 AND municipalidad_id=$7
          AND descripcion LIKE 'DEMO45 %' RETURNING id`,[
        r.reporte_id,a.latitud,a.longitud,a.direccion_detectada,a.calle_detectada,
        a.estado_geocodificacion,r.municipalidad_id]);
      if(result.rowCount!==1) throw Error(`No se actualizó el reporte ${r.reporte_id}; ROLLBACK.`);
      await insertAuditEvent(client,{tipo_actor:'sistema',actor_user_id:null,entidad:'reportes',
        entidad_id:r.reporte_id,accion:'demo45.ubicacion_redistribuida',
        cambios:{contexto:'Demo ficticia PavementDamagesG-7',municipalidad_id:r.municipalidad_id,
          antes:{latitud:r.before.latitud,longitud:r.before.longitud,direccion:r.before.direccion_detectada},
          despues:{latitud:a.latitud,longitud:a.longitud,direccion:a.direccion_detectada}}});
    }
    await client.query('COMMIT');
    console.log('OK: 45 ubicaciones DEMO45 actualizadas y 45 auditorías registradas.');
    console.log('No se modificaron fotos, folios, análisis, prioridad, ni el reporte 60.');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
try {
  const mode=process.argv.slice(2);
  if(mode.length!==1 || !['--preparar','--aplicar'].includes(mode[0])) throw Error('Usa exactamente --preparar o --aplicar.');
  if(mode[0]==='--preparar') await prepare(); else await apply();
} catch(e) { console.error('ERROR:',e.message); process.exitCode=1; }
finally { await pool.end(); }
