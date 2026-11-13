'use strict';

// node --test test/visionModel.integration.test.js
// Prueba de integración con el modelo REAL (sharp + TensorFlow.js + Worker). Se omite sola si
// faltan dependencias o la foto de demostración; el resto de la suite no la necesita.
// La primera inferencia carga el modelo: puede tardar varios segundos.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let sharp = null;
try { require.resolve('@tensorflow/tfjs'); sharp = require('sharp'); } catch { /* se omite */ }
const FOTO = path.join(__dirname, '..', 'fixtures', 'seed-photos', 'demo-report-001.png');
const omitir = !sharp || !fs.existsSync(FOTO) ? 'faltan @tensorflow/tfjs, sharp o la foto de demostración' : false;

process.env.VISION_TIMEOUT_MS = '120000';
delete process.env.VISION_ENABLED;
const visionService = require('../src/services/visionService');

const temporal = (nombre) => path.join(os.tmpdir(), `bache0-${process.pid}-${nombre}`);
test.after(async () => { await visionService.cerrarVision(); });

test('analiza una foto real: clases con confianza, versión trazable y sin severidad inventada', { skip: omitir }, async () => {
  const r = await visionService.analyzeImage(FOTO);
  assert.equal(r.ok, true, JSON.stringify(r));
  const a = r.analisis;
  assert.equal(a.proveedor, 'TensorFlow-Local');
  assert.match(a.version_modelo, /^.+@\d{4}-\d{2}-\d{2}\+sha256:[0-9a-f]{12}$/);
  assert.ok(a.version_modelo.length <= 100, 'cabe en analisis_vision.version_modelo VARCHAR(100)');
  assert.equal(a.detecciones.length, 3);
  const suma = a.detecciones.reduce((acc, d) => acc + d.confianza, 0);
  assert.ok(Math.abs(suma - 1) < 0.01, `softmax debe sumar ~1 (${suma})`);
  assert.equal(a.severidad_sugerida, null);
});

test('un segundo análisis reutiliza el worker y entrega la misma versión del modelo', { skip: omitir }, async () => {
  const [a, b] = [await visionService.analyzeImage(FOTO), await visionService.analyzeImage(FOTO)];
  assert.equal(a.analisis.version_modelo, b.analisis.version_modelo);
  assert.deepEqual(a.analisis.detecciones, b.analisis.detecciones, 'misma foto → mismo resultado (determinista)');
});

test('imagen corrupta: VISION_PREPROCESO_FALLO, sin romper el worker', { skip: omitir }, async () => {
  const ruta = temporal('corrupta.jpg');
  fs.writeFileSync(ruta, Buffer.from('esto no es una imagen'));
  try {
    const r = await visionService.analyzeImage(ruta);
    assert.equal(r.error_code, 'VISION_PREPROCESO_FALLO');
    assert.equal((await visionService.analyzeImage(FOTO)).ok, true);
  } finally { fs.rmSync(ruta, { force: true }); }
});

test('foto en escala de grises (1 canal) y foto minúscula: se convierten a RGB 224x224 y se analizan', { skip: omitir }, async () => {
  const gris = temporal('gris.png');
  const pequena = temporal('pequena.png');
  await sharp({ create: { width: 300, height: 200, channels: 3, background: '#808080' } }).greyscale().png().toFile(gris);
  await sharp({ create: { width: 8, height: 8, channels: 3, background: '#404040' } }).png().toFile(pequena);
  try {
    assert.equal((await visionService.analyzeImage(gris)).ok, true);
    assert.equal((await visionService.analyzeImage(pequena)).ok, true);
  } finally { fs.rmSync(gris, { force: true }); fs.rmSync(pequena, { force: true }); }
});

test('archivo inexistente: VISION_PREPROCESO_FALLO', { skip: omitir }, async () => {
  const r = await visionService.analyzeImage(temporal('no-existe.jpg'));
  assert.equal(r.error_code, 'VISION_PREPROCESO_FALLO');
});
