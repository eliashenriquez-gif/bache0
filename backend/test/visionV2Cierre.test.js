'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const v2 = require('../src/services/visionV2Service');
const { calcularPrioridad } = require('../src/services/priorityService');
const envOriginal = Object.fromEntries(['VISION_V2_PROVIDER','VISION_V2_PYTHON','ROBOFLOW_API_KEY'].map(k=>[k,process.env[k]]));
function fake(output,code=0) {
  const p = new EventEmitter();
  p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.stderr.resume=()=>{};p.kill=()=>{};
  queueMicrotask(()=>{p.stdout.emit('data',Buffer.from(output));p.emit('close',code);});
  return p;
}
const base = {ok:true,analisis:{modelo:'bache0-v2-segmentation-2-rfdetr-seg-small-t1',
  proveedor:'Roboflow-RFDETR-V2',tipo_desperfecto:'ninguno',confianza:0,
  severidad_sugerida:null,puntos_ia:0,baches_candidatos:0,area_visual_pct_union:0,detecciones:[]}};
function enable() {
 process.env.VISION_V2_PROVIDER='rfdetr';process.env.VISION_V2_PYTHON='python';process.env.ROBOFLOW_API_KEY='solo-pruebas';
}
test.afterEach(()=>{
 v2._setCrearProcesoParaPruebas(null);
 for (const [k,v] of Object.entries(envOriginal)) {if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('Foto sin detecciones es un resultado completo y con cero puntos',async()=>{
 enable();v2._setCrearProcesoParaPruebas(()=>fake(JSON.stringify(base)));
 const r=await v2.analyzeImage('imagen-prueba.jpg');
 assert.equal(r.ok,true); assert.deepEqual(r.analisis.detecciones,[]);
 assert.equal(r.analisis.severidad_sugerida,null); assert.equal(r.analisis.puntos_ia,0);
});
test('Aun con deteccion positiva la prioridad no aumenta sin severidad sugerida',()=>{
 const reporte={severidad:'media',concurrencia_vial:'baja',infraestructura_critica:'ninguna',clasificacion_vial:null,clasificacion_vial_estado:'pendiente',clasificacion_vial_fuente:null};
 const sin=calcularPrioridad(reporte,null,{ahora:new Date('2026-11-15T10:00:00Z')});
 const conDet=calcularPrioridad(reporte,{estado:'completado',proveedor:'Roboflow-RFDETR-V2',detecciones:[{etiqueta:'bache',confianza:.99,severidad_sugerida:null}]},{ahora:new Date('2026-11-15T10:00:00Z')});
 assert.equal(conDet.puntaje,sin.puntaje);assert.equal(conDet.prioridad,sin.prioridad);
 assert.ok(conDet.antecedentes.some(x=>x.factor==='analisis_imagen'&&x.puntos===0));
});
test('Sin credenciales no se ejecuta el proveedor externo',async()=>{
 process.env.VISION_V2_PROVIDER='rfdetr';delete process.env.ROBOFLOW_API_KEY;
 v2._setCrearProcesoParaPruebas(()=>{throw Error('no debería ejecutar')});
 const r=await v2.analyzeImage('foto.jpg');assert.equal(r.error_code,'VISION_V2_SIN_CREDENCIALES');
});
