'use strict';

const { parentPort } = require('worker_threads');
const tf = require('@tensorflow/tfjs');
const fs = require('node:fs');
const path = require('node:path');

let model = null;
let metadata = null;

// Simulador del fileSystem para evitar instalar tfjs-node en Windows
function localFileHandler(modelPath) {
  return {
    load: async () => {
      const modelJson = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      const dir = path.dirname(modelPath);
      const weightsPath = path.join(dir, modelJson.weightsManifest[0].paths[0]);
      const weightData = fs.readFileSync(weightsPath).buffer;
      return {
        modelTopology: modelJson.modelTopology,
        weightSpecs: modelJson.weightsManifest[0].weights,
        weightData: weightData
      };
    }
  };
}

async function cargarModelo() {
  if (model) return;
  const modelDir = path.join(__dirname, '..', 'models', 'vision');
  const modelPath = path.join(modelDir, 'model.json');
  const metaPath = path.join(modelDir, 'metadata.json');

  try {
    metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    model = await tf.loadLayersModel(localFileHandler(modelPath));
    // Calentamiento del modelo (predicción en vacío para que la primera real sea rápida)
    tf.tidy(() => { model.predict(tf.zeros([1, 224, 224, 3])); });
  } catch (error) {
    throw new Error('Faltan los archivos del modelo en src/models/vision/ o están corruptos.');
  }
}

parentPort.on('message', async (mensaje) => {
  try {
    await cargarModelo();
    
    const { pixelesCrudos, width, height } = mensaje;
    
    // Predicción matemática sin fugas de memoria
    const resultados = tf.tidy(() => {
      // 1. Convertir los píxeles que envió sharp a un tensor 3D
      const imgTensor = tf.tensor3d(new Uint8Array(pixelesCrudos), [height, width, 3], 'int32');
      
      // 2. Normalización de Teachable Machine: (pixel / 127.5) - 1
      const normalizado = imgTensor.toFloat().div(127.5).sub(1).expandDims(0);
      
      // 3. Predecir
      const prediccion = model.predict(normalizado);
      return prediccion.dataSync(); // Extrae los puntajes de forma síncrona
    });

    // Mapear los resultados con las etiquetas del metadata
    let mejorClase = metadata.labels[0];
    let mayorConfianza = resultados[0];

    for (let i = 1; i < resultados.length; i++) {
      if (resultados[i] > mayorConfianza) {
        mayorConfianza = resultados[i];
        mejorClase = metadata.labels[i];
      }
    }
    
    console.log(`[VisionWorker] ¡IA TERMINÓ!`);
    console.log(`[VisionWorker] Predicción: ${mejorClase}`);
    console.log(`[VisionWorker] Confianza: ${(mayorConfianza * 100).toFixed(2)}%`);

    // Traducción de la IA a nuestro contrato de dominio
    let tipo_desperfecto = 'ninguno';
    let severidad_sugerida = 'baja';

    // Asegúrate de que los nombres coincidan con los que le pusiste a las clases en Teachable Machine
    if (mejorClase.toLowerCase().includes('bache')) {
      tipo_desperfecto = 'bache';
      severidad_sugerida = mejorClase.toLowerCase().includes('grave') ? 'alta' : 'media';
    } 
    // Si la confianza es muy baja o es la clase "Otro"
    if (mayorConfianza < 0.6 || mejorClase.toLowerCase().includes('otro')) {
       tipo_desperfecto = 'ninguno';
       severidad_sugerida = 'baja';
    }

    parentPort.postMessage({
      ok: true,
      analisis: {
        tipo_desperfecto,
        severidad_sugerida,
        confianza: Number(mayorConfianza.toFixed(2)),
        proveedor: 'TensorFlow-Local',
        modelo: 'MobileNet-TeachableMachine'
      }
    });

  } catch (error) {
    parentPort.postMessage({ ok: false, error: error.message });
  }
});