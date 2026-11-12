'use strict';

// node --test test/visionService.test.js
// Prueba el servicio con dobles de sharp y de Worker: no necesita TensorFlow, sharp ni modelo.
// La prueba contra el modelo REAL está en test/visionModel.integration.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const visionService = require('../src/services/visionService');

const PIXELES = { pixeles: new Uint8Array(224 * 224 * 3), width: 224, height: 224 };
const ANALISIS_OK = { tipo_desperfecto: 'bache', severidad_sugerida: null, confianza: 0.9, proveedor: 'TensorFlow-Local', modelo: 'm', version_modelo: 'v', detecciones: [] };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Worker falso. `comportamiento(mensaje, worker)` decide qué hace al recibir una foto. */
class WorkerFalso extends EventEmitter {
  constructor(comportamiento) {
    super();
    this.comportamiento = comportamiento;
    this.mensajes = [];
    this.terminado = false;
    this.unrefLlamado = false;
  }
  postMessage(mensaje) { this.mensajes.push(mensaje); this.comportamiento(mensaje, this); }
  terminate() { this.terminado = true; this.emit('exit', 1); return Promise.resolve(1); }
  unref() { this.unrefLlamado = true; }
}
const responde = (analisis = ANALISIS_OK) => (m, w) => setImmediate(() => w.emit('message', { id: m.id, ok: true, analisis }));

let creados;
function instalar(comportamiento, preprocesar = async () => PIXELES) {
  creados = [];
  visionService._setDependenciasParaPruebas({
    preprocesar,
    crearWorker: () => { const w = new WorkerFalso(comportamiento); creados.push(w); return w; },
  });
}

const consolaOriginal = console.error;
test.beforeEach(() => {
  console.error = () => {};
  delete process.env.VISION_ENABLED;
  process.env.VISION_TIMEOUT_MS = '500';
  delete process.env.VISION_MAX_COLA;
  instalar(responde());
});
test.afterEach(async () => {
  await visionService.cerrarVision();
  visionService._setDependenciasParaPruebas();
  console.error = consolaOriginal;
});

test('analiza la imagen y devuelve el análisis del worker', async () => {
  const r = await visionService.analyzeImage('/tmp/foto.jpg');
  assert.deepEqual(r, { ok: true, analisis: ANALISIS_OK });
  assert.equal(creados[0].mensajes[0].width, 224);
  assert.equal(creados[0].mensajes[0].pixeles.length, 224 * 224 * 3);
});

test('REUTILIZA el mismo worker entre análisis (no se recarga el modelo por reporte)', async () => {
  await visionService.analyzeImage('/tmp/a.jpg');
  await visionService.analyzeImage('/tmp/b.jpg');
  await visionService.analyzeImage('/tmp/c.jpg');
  assert.equal(creados.length, 1);
  assert.equal(creados[0].mensajes.length, 3);
  assert.equal(creados[0].terminado, false);
});

test('el worker es unref(): no impide que el proceso (o node --test) termine', async () => {
  await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(creados[0].unrefLlamado, true);
});

test('los análisis concurrentes se ejecutan en serie (un solo análisis a la vez en el worker)', async () => {
  let enVuelo = 0;
  let maximo = 0;
  instalar((m, w) => {
    enVuelo += 1; maximo = Math.max(maximo, enVuelo);
    setTimeout(() => { enVuelo -= 1; w.emit('message', { id: m.id, ok: true, analisis: ANALISIS_OK }); }, 10);
  });
  const resultados = await Promise.all([1, 2, 3, 4].map((n) => visionService.analyzeImage(`/tmp/${n}.jpg`)));
  assert.ok(resultados.every((r) => r.ok));
  assert.equal(maximo, 1);
});

test('timeout: VISION_TIMEOUT, el worker colgado se termina y el siguiente análisis usa uno nuevo', async () => {
  process.env.VISION_TIMEOUT_MS = '40';
  let colgar = true;
  instalar((m, w) => { if (!colgar) responde()(m, w); });
  const r1 = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r1.error_code, 'VISION_TIMEOUT');
  assert.equal(creados[0].terminado, true);
  assert.equal(visionService._estado().hayWorker, false);

  colgar = false;
  const r2 = await visionService.analyzeImage('/tmp/b.jpg');
  assert.equal(r2.ok, true);
  assert.equal(creados.length, 2);
});

test('si sharp tarda más que el timeout NO se crea un worker huérfano', async () => {
  process.env.VISION_TIMEOUT_MS = '30';
  instalar(responde(), () => new Promise((resolver) => setTimeout(() => resolver(PIXELES), 120)));
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.error_code, 'VISION_TIMEOUT');
  await espera(200); // sharp "termina" después: no debe nacer ningún worker
  assert.equal(creados.length, 0);
});

test('imagen corrupta (sharp falla): VISION_PREPROCESO_FALLO y no se toca el worker', async () => {
  instalar(responde(), async () => { throw new Error('Input buffer contains unsupported image format'); });
  const r = await visionService.analyzeImage('/tmp/rota.jpg');
  assert.equal(r.ok, false);
  assert.equal(r.error_code, 'VISION_PREPROCESO_FALLO');
  assert.equal(creados.length, 0);
});

test('un preprocesador que lanza de forma síncrona tampoco rompe la promesa', async () => {
  instalar(responde(), () => { throw new Error('boom'); });
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.error_code, 'VISION_PREPROCESO_FALLO');
});

test('error en la inferencia (ok:false del worker): VISION_WORKER_ERROR y el worker se conserva', async () => {
  instalar((m, w) => setImmediate(() => w.emit('message', { id: m.id, ok: false, error: 'No se pudo cargar el modelo' })));
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.error_code, 'VISION_WORKER_ERROR');
  assert.equal(creados[0].terminado, false);
});

test('el hilo emite "error": VISION_WORKER_CAIDO y se descarta', async () => {
  instalar((m, w) => setImmediate(() => w.emit('error', new Error('OOM'))));
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.error_code, 'VISION_WORKER_CAIDO');
  assert.equal(creados[0].terminado, true);
});

test('el hilo termina solo (exit) a mitad de análisis: VISION_WORKER_CAIDO sin esperar al timeout', async () => {
  process.env.VISION_TIMEOUT_MS = '5000';
  instalar((m, w) => setImmediate(() => w.emit('exit', 1)));
  const inicio = Date.now();
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.error_code, 'VISION_WORKER_CAIDO');
  assert.ok(Date.now() - inicio < 1000);
});

test('un "error" mientras el worker está ocioso NO es una excepción no capturada', async () => {
  await visionService.analyzeImage('/tmp/a.jpg');
  assert.doesNotThrow(() => creados[0].emit('error', new Error('fallo tardío')));
});

test('un worker que murió entre análisis se reemplaza automáticamente', async () => {
  await visionService.analyzeImage('/tmp/a.jpg');
  creados[0].emit('exit', 1);
  const r = await visionService.analyzeImage('/tmp/b.jpg');
  assert.equal(r.ok, true);
  assert.equal(creados.length, 2);
});

test('los mensajes de otro análisis (id distinto) se ignoran', async () => {
  instalar((m, w) => setImmediate(() => {
    w.emit('message', { id: m.id + 999, ok: true, analisis: { tipo_desperfecto: 'ajeno' } });
    w.emit('message', { id: m.id, ok: true, analisis: ANALISIS_OK });
  }));
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.analisis.tipo_desperfecto, 'bache');
});

test('VISION_ENABLED=false: VISION_DESHABILITADA sin preprocesar ni crear worker', async () => {
  process.env.VISION_ENABLED = 'false';
  let llamadas = 0;
  instalar(responde(), async () => { llamadas += 1; return PIXELES; });
  assert.equal(visionService.visionHabilitada(), false);
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.error_code, 'VISION_DESHABILITADA');
  assert.equal(llamadas, 0);
  assert.equal(creados.length, 0);
});

test('cola saturada: VISION_SATURADO en vez de acumular trabajo sin límite', async () => {
  process.env.VISION_MAX_COLA = '2';
  instalar((m, w) => setTimeout(() => w.emit('message', { id: m.id, ok: true, analisis: ANALISIS_OK }), 20));
  const [a, b, c] = await Promise.all([1, 2, 3].map((n) => visionService.analyzeImage(`/tmp/${n}.jpg`)));
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.error_code, 'VISION_SATURADO');
  assert.equal(visionService._estado().enCola, 0);
});

test('precalentar() crea el worker; cerrarVision() lo termina y es idempotente', async () => {
  assert.equal(visionService.precalentar(), true);
  assert.equal(creados.length, 1);
  await visionService.cerrarVision();
  assert.equal(creados[0].terminado, true);
  await visionService.cerrarVision();
  process.env.VISION_ENABLED = 'false';
  assert.equal(visionService.precalentar(), false);
});

test('VISION_TIMEOUT_MS inválido usa el valor por defecto (30 s) en lugar de 0 ms', async () => {
  process.env.VISION_TIMEOUT_MS = 'abc';
  const r = await visionService.analyzeImage('/tmp/a.jpg');
  assert.equal(r.ok, true);
});
