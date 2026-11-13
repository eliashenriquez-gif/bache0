'use strict';

/**
 * Worker REUTILIZABLE de inferencia. El hilo principal lo crea una sola vez (visionService)
 * y le envía una foto por mensaje; así TensorFlow y los pesos se cargan UNA vez, no por reporte.
 *
 * Protocolo:  main → worker  { id, pixeles: Uint8Array(224*224*3 RGB), width, height }
 *             worker → main  { id, ok: true, analisis } | { id, ok: false, error }
 */

const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tf = require('@tensorflow/tfjs');
const { interpretarPrediccion } = require('./visionPrediction');

const MODEL_DIR = path.join(__dirname, '..', 'models', 'vision');
const TAM = 224;

/**
 * IMPORTANTE (byteOffset): Buffer.buffer puede ser un ArrayBuffer COMPARTIDO (pool de Node)
 * con byteOffset ≠ 0 y tamaño mayor al del contenido. Para archivos grandes (como weights.bin,
 * 2 MB) Node no usa el pool y funciona "por casualidad", pero TF.js leería basura con un archivo
 * pequeño o con Buffer.concat. Siempre se copia exactamente el rango del Buffer.
 */
function aArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/** Lee model.json + todos los fragmentos de pesos y los entrega como "model artifacts" de TF.js. */
function leerArtefactos(rutaModelo) {
  const modelJson = JSON.parse(fs.readFileSync(rutaModelo, 'utf8'));
  const dir = path.dirname(rutaModelo);
  const grupos = modelJson.weightsManifest;
  if (!Array.isArray(grupos) || grupos.length === 0) {
    throw new Error('model.json no declara weightsManifest.');
  }

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

let cargando = null; // Promise<{ model, metadata, version_modelo }>

function cargarModelo() {
  if (!cargando) {
    cargando = (async () => {
      const metadata = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, 'metadata.json'), 'utf8'));
      const { artefactos, sha256 } = leerArtefactos(path.join(MODEL_DIR, 'model.json'));

      const model = await tf.loadLayersModel({ load: async () => artefactos });

      const salidas = model.outputs[0].shape[model.outputs[0].shape.length - 1];
      if (salidas !== metadata.labels.length) {
        throw new Error(`El modelo tiene ${salidas} salidas y metadata.json ${metadata.labels.length} etiquetas.`);
      }

      // Calentamiento: la primera inferencia real no paga la compilación.
      tf.tidy(() => { model.predict(tf.zeros([1, TAM, TAM, 3])); });

      // Versión trazable: nombre + fecha de exportación + huella de los pesos (no depende de que alguien la actualice a mano).
      const exportado = String(metadata.timeStamp || '').slice(0, 10) || 'sin-fecha';
      const version_modelo = `${metadata.modelName || 'modelo'}@${exportado}+sha256:${sha256.slice(0, 12)}`;

      return { model, metadata, version_modelo };
    })().catch((error) => {
      cargando = null; // permite reintentar en el siguiente mensaje
      throw new Error(`No se pudo cargar el modelo de visión (src/models/vision/): ${error.message}`);
    });
  }
  return cargando;
}

function predecir(model, pixeles, width, height) {
  if (width !== TAM || height !== TAM || pixeles.length !== TAM * TAM * 3) {
    throw new Error(`Entrada inválida: se esperaba ${TAM}x${TAM} RGB y llegó ${width}x${height} (${pixeles.length} bytes).`);
  }

  // tf.tidy libera TODOS los tensores intermedios; lo que sale es un TypedArray (no un tensor).
  const salida = tf.tidy(() => {
    const imagen = tf.tensor3d(new Uint8Array(pixeles), [height, width, 3], 'int32');
    // Normalización de Teachable Machine: (pixel / 127.5) - 1
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

// Carga anticipada: cuando llegue el primer reporte el modelo ya está listo.
cargarModelo().catch((error) => console.error(`[VisionWorker] ${error.message}`));
