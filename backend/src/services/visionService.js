'use strict';

const { Worker } = require('node:worker_threads');
const path = require('node:path');
const sharp = require('sharp');

const VISION_TIMEOUT_MS = Number(process.env.VISION_TIMEOUT_MS) || 10000; // 10 segundos tope

/**
 * Analiza una imagen usando un modelo de TensorFlow local ejecutado en un Worker Thread.
 * Mantiene intacto el patrón fail-safe (Envelope) para el reportService.
 * 
 * @param {string} rutaFoto Ruta absoluta de la fotografía.
 * @returns {Promise<Object>} { ok: true, analisis: {...} } o { ok: false, error_code, mensaje }
 */
async function analyzeImage(rutaFoto) {
  if (process.env.VISION_ENABLED === 'false') {
    return { ok: false, error_code: 'VISION_DESHABILITADA', mensaje: 'Módulo de visión apagado.' };
  }

  return new Promise(async (resolve) => {
    let worker;
    let timeoutId;

    const finalizar = (resultado) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (worker) worker.terminate().catch(() => {});
      resolve(resultado);
    };

    timeoutId = setTimeout(() => {
      finalizar({ ok: false, error_code: 'VISION_TIMEOUT', mensaje: 'El análisis visual tardó demasiado.' });
    }, VISION_TIMEOUT_MS);

    try {
      // Usamos sharp para extraer los píxeles crudos (sin decodificadores nativos en TFJS)
      const { data, info } = await sharp(rutaFoto)
        .resize(224, 224, { fit: 'cover' })
        .removeAlpha() // Asegura 3 canales (RGB)
        .raw()
        .toBuffer({ resolveWithObject: true });

      worker = new Worker(path.join(__dirname, 'visionWorker.js'));

      worker.on('message', (respuesta) => {
        if (respuesta.ok) {
          finalizar({ ok: true, analisis: respuesta.analisis });
        } else {
          console.error('[VisionWorker] Error interno:', respuesta.error);
          finalizar({ ok: false, error_code: 'VISION_WORKER_ERROR', mensaje: 'El modelo local falló.' });
        }
      });

      worker.on('error', (error) => {
        console.error('[VisionWorker] Se cayó el hilo:', error);
        finalizar({ ok: false, error_code: 'VISION_WORKER_CAIDO', mensaje: 'Fallo crítico en el hilo de IA.' });
      });

      // Le pasamos los píxeles puros al worker
      worker.postMessage({ pixelesCrudos: data, width: info.width, height: info.height });

    } catch (error) {
      console.error('[VisionService] Error preparando imagen:', error.message);
      finalizar({ ok: false, error_code: 'VISION_PREPROCESO_FALLO', mensaje: 'No se pudo procesar la foto.' });
    }
  });
}

module.exports = {
  analyzeImage
};