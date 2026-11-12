'use strict';

const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tf = require('@tensorflow/tfjs');
const { interpretarPrediccion } = require('./visionPrediction');

const MODEL_DIR = path.join(__dirname, '..', 'models', 'vision');
const TAM = 224;

function aArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function leerArtefactos(rutaModelo) {
  const modelJson = JSON.parse(fs.readFileSync(rutaModelo, 'utf8'));
  const dir = path.dirname(rutaModelo);
  const grupos = modelJson.weightsManifest;
  const pesos = Buffer.concat(
    grupos.flatMap((g) => g.paths).map((archivo) => fs.readFileSync(path.join(dir, archivo)))
  );

  return {
    artefactos: {
      modelTopology: modelJson.modelTopology,
      weightSpecs: grupos.flatMap((g) => g.weights),
      weightData: aArrayBuffer(pesos),
    },
    sha256: crypto.createHash('sha256').update(pesos).digest('hex'),
  };
}

let cargando = null;

function cargarModelo() {
  if (!cargando) {
    cargando = (async () => {
      const metadata = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, 'metadata.json'), 'utf8'));
      const { artefactos, sha256 } = leerArtefactos(path.join(MODEL_DIR, 'model.json'));
      const model = await tf.loadLayersModel({ load: async () => artefactos });

      tf.tidy(() => { model.predict(tf.zeros([1, TAM, TAM, 3])); }); // Calentamiento

      const exportado = String(metadata.timeStamp || '').slice(0, 10) || 'sin-fecha';
      const version_modelo = `${metadata.modelName || 'modelo'}@${exportado}+sha256:${sha256.slice(0, 12)}`;

      return { model, metadata, version_modelo };
    })().catch((error) => {
      cargando = null;
      throw new Error(`No se pudo cargar el modelo: ${error.message}`);
    });
  }
  return cargando;
}

function predecir(model, pixeles, width, height) {
  const salida = tf.tidy(() => {
    const imagen = tf.tensor3d(new Uint8Array(pixeles), [height, width, 3], 'int32');
    const entrada = imagen.cast('float32').div(127.5).sub(1).expandDims(0);
    const prediccion = model.predict(entrada);
    const tensor = Array.isArray(prediccion) ? prediccion[0] : prediccion;
    return tensor.dataSync();
  });
  return Array.from(salida);
}

parentPort.on('message', async ({ id, pixeles, width, height }) => {
  try {
    const { model, metadata, version_modelo } = await cargarModelo();
    const puntajes = predecir(model, pixeles, width, height);
    parentPort.postMessage({
      id,
      ok: true,
      analisis: interpretarPrediccion(metadata.labels, puntajes, { version_modelo }),
    });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: error.message });
  }
});

cargarModelo().catch((error) => console.error(`[VisionWorker] ${error.message}`));