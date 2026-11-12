'use strict';

const path = require('node:path');
const { Worker } = require('node:worker_threads');

/**
 * VisionService — inferencia 100 % local (TensorFlow.js + sharp) en UN Worker reutilizable.
 *
 * Contrato (no cambia para reportService): analyzeImage(rutaFoto) NUNCA lanza ni rechaza.
 *   → { ok: true,  analisis: {...} }
 *   → { ok: false, error_code, mensaje }
 *
 * Diseño:
 *  - El Worker se crea de forma perezosa y se reutiliza (TensorFlow + pesos se cargan una vez).
 *  - Los análisis se ejecutan EN SERIE (cola): TF.js en CPU es de un solo hilo, paralelizar solo
 *    compite por CPU. La cola tiene tope (VISION_MAX_COLA) para no acumular trabajo sin límite.
 *  - worker.unref(): el Worker nunca impide que el proceso termine → los tests y los scripts
 *    salen solos, sin "apagado ordenado". cerrarVision() existe por si se quiere cerrar a mano.
 *  - Si hay timeout o el hilo cae, ese Worker se descarta y el siguiente análisis crea otro
 *    (autorrecuperación).
 */

const WORKER_PATH = path.join(__dirname, 'visionWorker.js');
const TAM = 224;

const entero = (valor, porDefecto, minimo = 1) => {
  const n = Number(valor);
  return Number.isInteger(n) && n >= minimo ? n : porDefecto;
};
const timeoutMs = () => {
  const n = Number(process.env.VISION_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 30000; // 30 s: cubre la primera carga del modelo en un notebook
};

const visionHabilitada = () => process.env.VISION_ENABLED !== 'false';

const fallo = (error_code, mensaje) => ({ ok: false, error_code, mensaje });

// ───────────────────────────── Preprocesamiento (sharp) ─────────────────────────────
/**
 * Foto → 224x224 RGB crudo. sharp se carga aquí (perezoso): importar este módulo no exige sharp.
 *  - toColourspace('srgb'): una foto en escala de grises (1 canal) o CMYK produciría un buffer
 *    que NO es RGB y rompería el tensor [224,224,3].
 *  - limitInputPixels: protege de imágenes enormes ("bombas de descompresión").
 *  - Se valida el tamaño exacto del buffer antes de enviarlo al worker.
 */
async function preprocesarImagen(rutaFoto) {
  const sharp = require('sharp');
  const { data, info } = await sharp(rutaFoto, { limitInputPixels: 50_000_000 })
    .resize(TAM, TAM, { fit: 'cover' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== TAM || info.height !== TAM || info.channels !== 3 || data.length !== TAM * TAM * 3) {
    throw new Error(`Formato de píxeles inesperado: ${info.width}x${info.height}x${info.channels}`);
  }
  return { pixeles: data, width: info.width, height: info.height };
}

// ───────────────────────────── Worker reutilizable ─────────────────────────────
const dependencias = {
  preprocesar: preprocesarImagen,
  crearWorker: () => new Worker(WORKER_PATH),
};

let worker = null;
let secuencia = 0;

function obtenerWorker() {
  if (worker) return worker;
  const w = dependencias.crearWorker();
  // Listener PERMANENTE de 'error': sin él, un fallo del hilo mientras está ocioso se
  // convierte en una excepción no capturada que tumba todo el servidor.
  w.on('error', (error) => console.error('[VisionService] Error en el hilo de IA:', error?.message ?? error));
  w.once('exit', () => { if (worker === w) worker = null; });
  if (typeof w.unref === 'function') w.unref();
  worker = w;
  return w;
}

function descartarWorker(w) {
  if (worker === w) worker = null;
  try {
    Promise.resolve(w.terminate()).catch(() => {});
  } catch { /* ya estaba terminado */ }
}

/** Carga el modelo en segundo plano al arrancar el servidor (opcional). */
function precalentar() {
  if (!visionHabilitada()) return false;
  try {
    obtenerWorker();
    return true;
  } catch (error) {
    console.error('[VisionService] No se pudo precalentar el worker:', error.message);
    return false;
  }
}

/** Cierre manual (opcional: el worker es unref y no bloquea la salida del proceso). */
async function cerrarVision() {
  const w = worker;
  worker = null;
  if (w) await Promise.resolve(w.terminate()).catch(() => {});
}

function ejecutarEnWorker(pre, limiteMs) {
  return new Promise((resolve) => {
    let w;
    try {
      w = obtenerWorker();
    } catch (error) {
      console.error('[VisionService] No se pudo crear el worker:', error.message);
      return resolve(fallo('VISION_WORKER_CAIDO', 'No se pudo iniciar el hilo de IA.'));
    }

    const id = ++secuencia;
    let timer = null;
    let terminado = false;

    const terminar = (resultado, descartar) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      w.off('message', alMensaje);
      w.off('error', alError);
      w.off('exit', alSalir);
      if (descartar) descartarWorker(w);
      resolve(resultado);
    };

    function alMensaje(respuesta) {
      if (!respuesta || respuesta.id !== id) return; // mensaje de otro análisis: se ignora
      if (respuesta.ok) return terminar({ ok: true, analisis: respuesta.analisis }, false);
      // El hilo sigue sano; solo falló esta inferencia (p. ej. modelo ausente): no se descarta.
      console.error('[VisionService] Falló la inferencia:', respuesta.error);
      return terminar(fallo('VISION_WORKER_ERROR', 'El modelo local falló.'), false);
    }
    function alError(error) {
      console.error('[VisionService] Se cayó el hilo de IA:', error?.message ?? error);
      terminar(fallo('VISION_WORKER_CAIDO', 'Fallo crítico en el hilo de IA.'), true);
    }
    function alSalir(codigo) {
      console.error(`[VisionService] El hilo de IA terminó inesperadamente (código ${codigo}).`);
      terminar(fallo('VISION_WORKER_CAIDO', 'Fallo crítico en el hilo de IA.'), true);
    }

    timer = setTimeout(
      () => terminar(fallo('VISION_TIMEOUT', 'El análisis visual tardó demasiado.'), true), // un hilo colgado no se reutiliza
      limiteMs
    );

    w.on('message', alMensaje);
    w.on('error', alError);
    w.on('exit', alSalir);
    w.postMessage({ id, pixeles: pre.pixeles, width: pre.width, height: pre.height });
  });
}

/** Rechaza con { codigo: 'VISION_TIMEOUT' } si la promesa no termina a tiempo. */
function conLimite(promesa, ms) {
  let timer;
  const limite = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { codigo: 'VISION_TIMEOUT' })), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

async function analizar(rutaFoto) {
  try {
    const total = timeoutMs();
    const inicio = Date.now();

    let pre;
    try {
      pre = await conLimite(Promise.resolve().then(() => dependencias.preprocesar(rutaFoto)), total);
    } catch (error) {
      if (error?.codigo === 'VISION_TIMEOUT') return fallo('VISION_TIMEOUT', 'El análisis visual tardó demasiado.');
      console.error('[VisionService] Error preparando imagen:', error?.message ?? error);
      return fallo('VISION_PREPROCESO_FALLO', 'No se pudo procesar la foto.');
    }
    // Si el timeout venció durante sharp NO se llega aquí: nunca se crea un Worker "huérfano".

    return await ejecutarEnWorker(pre, Math.max(1, total - (Date.now() - inicio)));
  } catch (error) {
    console.error('[VisionService] Error inesperado:', error?.message ?? error);
    return fallo('VISION_WORKER_ERROR', 'El modelo local falló.');
  }
}

// ───────────────────────────── API pública ─────────────────────────────
let cola = Promise.resolve();
let enCola = 0;

/**
 * Analiza una fotografía ya guardada.
 * @param {string} rutaFoto Ruta absoluta del archivo.
 * @returns {Promise<{ok:true, analisis:object}|{ok:false, error_code:string, mensaje:string}>}
 */
function analyzeImage(rutaFoto) {
  if (!visionHabilitada()) {
    return Promise.resolve(fallo('VISION_DESHABILITADA', 'Módulo de visión apagado.'));
  }
  if (enCola >= entero(process.env.VISION_MAX_COLA, 20)) {
    return Promise.resolve(fallo('VISION_SATURADO', 'Hay demasiados análisis en espera.'));
  }

  enCola += 1;
  const tarea = cola.then(() => analizar(rutaFoto)).finally(() => { enCola -= 1; });
  cola = tarea.catch(() => {});
  return tarea;
}

module.exports = {
  analyzeImage,
  visionHabilitada,
  precalentar,
  cerrarVision,
  // Solo para pruebas: reemplaza sharp / Worker por dobles.
  _setDependenciasParaPruebas(sobrescritas = {}) {
    dependencias.preprocesar = sobrescritas.preprocesar ?? preprocesarImagen;
    dependencias.crearWorker = sobrescritas.crearWorker ?? (() => new Worker(WORKER_PATH));
  },
  _estado: () => ({ hayWorker: worker !== null, enCola }),
};
