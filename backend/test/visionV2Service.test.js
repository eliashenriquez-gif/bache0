'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const service = require('../src/services/visionV2Service');
const preserved = { ...process.env };
function fakeProcess(stdout, code = 0) {
  const process = new EventEmitter();
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter(); process.stderr.resume = () => {};
  process.kill = () => {};
  queueMicrotask(() => { process.stdout.emit('data', Buffer.from(stdout)); process.emit('close', code); });
  return process;
}
const valid = {ok:true, analisis:{ modelo:'bache0-v2-segmentation-2-rfdetr-seg-small-t1',
  proveedor:'Roboflow-RFDETR-V2', confianza:.8, severidad_sugerida:null,puntos_ia:0,
  detecciones:[{ etiqueta:'bache',confianza:.8,severidad_sugerida:null }] }};
test.afterEach(() => {
  service._setCrearProcesoParaPruebas(null);
  for (const k of ['VISION_V2_PROVIDER','VISION_V2_PYTHON','ROBOFLOW_API_KEY']) {
    if (preserved[k] === undefined) delete process.env[k]; else process.env[k]=preserved[k];
  }
});
test('desactivado por defecto, no inicia subprocess', async () => {
  delete process.env.VISION_V2_PROVIDER;
  service._setCrearProcesoParaPruebas(() => { throw new Error('se invocó'); });
  const result=await service.analyzeImage('foto.jpg');
  assert.equal(result.ok,false);assert.equal(result.error_code,'VISION_V2_DESHABILITADA');
});
test('sin credenciales no inicia subprocess', async () => {
  process.env.VISION_V2_PROVIDER='rfdetr';delete process.env.ROBOFLOW_API_KEY;
  service._setCrearProcesoParaPruebas(() => { throw new Error('se invocó'); });
  const result=await service.analyzeImage('foto.jpg');
  assert.equal(result.error_code,'VISION_V2_SIN_CREDENCIALES');
});
test('respuesta válida devuelve análisis sin severidad inventada', async () => {
  process.env.VISION_V2_PROVIDER='rfdetr';process.env.VISION_V2_PYTHON='python';process.env.ROBOFLOW_API_KEY='fake';
  service._setCrearProcesoParaPruebas(() => fakeProcess(JSON.stringify(valid)));
  const result=await service.analyzeImage('foto.jpg');
  assert.equal(result.ok,true);assert.equal(result.analisis.puntos_ia,0);
});
test('rechaza datos externos que intenten inyectar puntos', async () => {
  process.env.VISION_V2_PROVIDER='rfdetr';process.env.VISION_V2_PYTHON='python';process.env.ROBOFLOW_API_KEY='fake';
  service._setCrearProcesoParaPruebas(() => fakeProcess(JSON.stringify({...valid,analisis:{...valid.analisis,puntos_ia:5}})));
  const result=await service.analyzeImage('foto.jpg');
  assert.equal(result.ok,false);assert.equal(result.error_code,'VISION_V2_CONTRATO');
});
test('respuestas corruptas no se aceptan', async () => {
  process.env.VISION_V2_PROVIDER='rfdetr';process.env.VISION_V2_PYTHON='python';process.env.ROBOFLOW_API_KEY='fake';
  service._setCrearProcesoParaPruebas(() => fakeProcess('not json'));
  const result=await service.analyzeImage('foto.jpg');
  assert.equal(result.ok,false);assert.equal(result.error_code,'VISION_V2_JSON');
});
