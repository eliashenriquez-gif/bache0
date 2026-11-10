'use strict';

// Ejecutar con: node --test tests/visionService.test.js
// Usa un SDK simulado: no llama a Gemini ni necesita clave real.

process.env.GEMINI_API_KEY = 'clave-de-prueba';
process.env.GEMINI_MODELS = 'modelo-a,modelo-b';
process.env.VISION_TIMEOUT_MS = '60';
process.env.VISION_BACKOFF_BASE_MS = '1';
delete process.env.VISION_ENABLED;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

// ── SDK simulado: cada test define cómo responde cada llamada ──
let comportamiento = null;
const llamadas = [];

class FakeGoogleGenerativeAI {
  getGenerativeModel({ model }) {
    return {
      generateContent: (_partes, opciones) => {
        llamadas.push(model);
        return comportamiento({ model, signal: opciones?.signal, n: llamadas.length });
      },
    };
  }
}

const cargaOriginal = Module._load;
Module._load = function (request, ...resto) {
  if (request === '@google/generative-ai') return { GoogleGenerativeAI: FakeGoogleGenerativeAI };
  return cargaOriginal.call(this, request, ...resto);
};
const { analyzeImage } = require('../src/services/visionService');
Module._load = cargaOriginal;

// ── Utilidades ──
const imagen = path.join(os.tmpdir(), `bache0-test-${process.pid}.jpg`);
fs.writeFileSync(imagen, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]));
test.after(() => fs.rmSync(imagen, { force: true }));

const respuesta = (obj) => ({ response: { text: () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) } });
const valida = { tipo_desperfecto: 'bache', severidad_sugerida: 'alta', confianza: 0.82 };
const conStatus = (status, msg) => Object.assign(new Error(`[${status} ${msg}] error simulado`), { status });
const colgado = ({ signal }) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })));
});

const preparar = (fn) => { llamadas.length = 0; comportamiento = fn; };

// Silenciar logs de error esperados durante las pruebas.
const consoleError = console.error;
test.before(() => { console.error = () => {}; });
test.after(() => { console.error = consoleError; });

// ── Pruebas ──
test('éxito: devuelve el análisis normalizado con proveedor y modelo', async () => {
  preparar(async () => respuesta(valida));
  const r = await analyzeImage(imagen);
  assert.equal(r.ok, true);
  assert.deepEqual(r.analisis, { ...valida, proveedor: 'google-gemini', modelo: 'modelo-a' });
  assert.equal(llamadas.length, 1);
});

test('503 en el primer modelo: reintenta y cae al siguiente modelo', async () => {
  preparar(async ({ model }) => {
    if (model === 'modelo-a') throw conStatus(503, 'Service Unavailable');
    return respuesta(valida);
  });
  const r = await analyzeImage(imagen);
  assert.equal(r.ok, true);
  assert.equal(r.analisis.modelo, 'modelo-b');
  assert.deepEqual(llamadas, ['modelo-a', 'modelo-a', 'modelo-b']);
});

test('503 en todos los modelos: error_code VISION_UPSTREAM_503 y 4 intentos', async () => {
  preparar(async () => { throw conStatus(503, 'Service Unavailable'); });
  const r = await analyzeImage(imagen);
  assert.equal(r.ok, false);
  assert.equal(r.error_code, 'VISION_UPSTREAM_503');
  assert.equal(llamadas.length, 4);
});

test('cuelgue: se cancela con AbortController y devuelve VISION_TIMEOUT', async () => {
  preparar(colgado);
  const inicio = Date.now();
  const r = await analyzeImage(imagen);
  assert.equal(r.ok, false);
  assert.equal(r.error_code, 'VISION_TIMEOUT');
  assert.ok(Date.now() - inicio < 2000);
});

test('429 se reintenta; 404 pasa directo al siguiente modelo sin reintentar', async () => {
  preparar(async ({ model }) => {
    if (model === 'modelo-a') throw conStatus(404, 'Not Found');
    return respuesta(valida);
  });
  const r = await analyzeImage(imagen);
  assert.equal(r.ok, true);
  assert.deepEqual(llamadas, ['modelo-a', 'modelo-b']);

  preparar(async () => { throw conStatus(429, 'Too Many Requests'); });
  const r2 = await analyzeImage(imagen);
  assert.equal(r2.error_code, 'VISION_UPSTREAM_429');
  assert.equal(llamadas.length, 4);
});

test('401/403: error fatal, no prueba otros modelos', async () => {
  preparar(async () => { throw conStatus(403, 'Forbidden'); });
  const r = await analyzeImage(imagen);
  assert.equal(r.error_code, 'VISION_AUTH');
  assert.equal(llamadas.length, 1);
});

test('error de red: VISION_RED', async () => {
  preparar(async () => { throw new TypeError('fetch failed'); });
  const r = await analyzeImage(imagen);
  assert.equal(r.error_code, 'VISION_RED');
});

test('respuestas inválidas del modelo: VISION_INVALID_RESPONSE', async () => {
  const invalidas = [
    { ...valida, tipo_desperfecto: 'pothole' },
    { ...valida, severidad_sugerida: 'critica' },
    { ...valida, confianza: 'abc' },
    { ...valida, confianza: null },
    { ...valida, confianza: 85 },
    { ...valida, confianza: -0.2 },
    { tipo_desperfecto: 'bache' },
    'esto no es json',
    '[]',
    'null',
  ];
  for (const cuerpo of invalidas) {
    preparar(async () => respuesta(cuerpo));
    const r = await analyzeImage(imagen);
    assert.equal(r.ok, false, JSON.stringify(cuerpo));
    assert.equal(r.error_code, 'VISION_INVALID_RESPONSE', JSON.stringify(cuerpo));
  }
});

test('acepta confianza numérica en texto y bloque markdown', async () => {
  preparar(async () => respuesta('```json\n{"tipo_desperfecto":"Bache","severidad_sugerida":"ALTA","confianza":"0.7"}\n```'));
  const r = await analyzeImage(imagen);
  assert.equal(r.ok, true);
  assert.equal(r.analisis.tipo_desperfecto, 'bache');
  assert.equal(r.analisis.confianza, 0.7);
});

test('archivo ilegible: VISION_ARCHIVO_ILEGIBLE sin llamar al SDK', async () => {
  preparar(async () => respuesta(valida));
  const r = await analyzeImage(path.join(os.tmpdir(), 'no-existe-bache0.jpg'));
  assert.equal(r.ok, false);
  assert.equal(r.error_code, 'VISION_ARCHIVO_ILEGIBLE');
  assert.equal(llamadas.length, 0);
});

test('visión deshabilitada y clave ausente devuelven su error_code', async () => {
  preparar(async () => respuesta(valida));

  process.env.VISION_ENABLED = 'false';
  assert.equal((await analyzeImage(imagen)).error_code, 'VISION_DESHABILITADA');
  delete process.env.VISION_ENABLED;

  const clave = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal((await analyzeImage(imagen)).error_code, 'VISION_SIN_CLAVE');
  process.env.GEMINI_API_KEY = clave;
  assert.equal(llamadas.length, 0);
});

test('nunca lanza, aunque el SDK falle de forma inesperada', async () => {
  preparar(() => { throw new Error('fallo síncrono inesperado'); });
  const r = await analyzeImage(imagen);
  assert.equal(r.ok, false);
  assert.equal(r.error_code, 'VISION_ERROR_DESCONOCIDO');
  assert.equal((await analyzeImage(undefined)).ok, false);
});
