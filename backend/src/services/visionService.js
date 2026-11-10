'use strict';

const fs = require('node:fs/promises');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ───────────────────────────── Configuración ─────────────────────────────
const PROVIDER = 'google-gemini';
const MODELOS_POR_DEFECTO = ['gemini-3.8-flash', 'gemini-2.5-flash'];

function numeroEnv(nombre, porDefecto) {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor >= 0 && process.env[nombre] !== '' ? valor : porDefecto;
}

const MODEL_CHAIN = (() => {
  const lista = (process.env.GEMINI_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean);
  return lista.length > 0 ? lista : MODELOS_POR_DEFECTO;
})();
const TIMEOUT_MS = numeroEnv('VISION_TIMEOUT_MS', 8000) || 8000;
const MAX_INTENTOS = 2;
const BACKOFF_BASE_MS = numeroEnv('VISION_BACKOFF_BASE_MS', 1000);

const TIPOS_DESPERFECTO = [
  'bache',
  'grieta_longitudinal',
  'grieta_transversal',
  'grieta_piel_de_cocodrilo',
  'otro',
  'ninguno',
];
const SEVERIDADES = ['baja', 'media', 'alta'];

// CORRECCIÓN 1: el PROMPT lista los valores permitidos para que el modelo no invente etiquetas.
const PROMPT = `Eres un asistente que analiza fotografías de calzadas urbanas.
Responde ESTRICTAMENTE con un único objeto JSON, sin texto adicional ni markdown, con estas tres claves:
- "tipo_desperfecto": uno de ${JSON.stringify(TIPOS_DESPERFECTO)}. Usa "ninguno" si la imagen no muestra un desperfecto vial.
- "severidad_sugerida": uno de ${JSON.stringify(SEVERIDADES)}, según lo que se aprecia en la imagen.
- "confianza": número entre 0 y 1 que expresa qué tan seguro estás de tu respuesta.
No estimes medidas ni profundidades. Si la imagen no es clara, baja la confianza.`;

// ───────────────────────────── Errores con código ─────────────────────────────
// `visionCode` evita chocar con `error.code` de Node (por ejemplo ENOENT).
function visionError(code, message, cause) {
  const error = new Error(message);
  error.visionCode = code;
  if (cause) error.cause = cause;
  return error;
}

function statusDe(error) {
  const status = Number(error?.status);
  if (Number.isFinite(status) && status > 0) return status;
  const coincidencia = /\[(\d{3})\b/.exec(String(error?.message ?? ''));
  return coincidencia ? Number(coincidencia[1]) : null;
}

const ES_ERROR_DE_RED = /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ETIMEDOUT/i;

function codigoDeError(error) {
  if (error?.visionCode) return error.visionCode;
  const status = statusDe(error);
  if (status === 503) return 'VISION_UPSTREAM_503';
  if (status === 429) return 'VISION_UPSTREAM_429';
  if (status === 401 || status === 403) return 'VISION_AUTH';
  if (status === 404) return 'VISION_MODELO_NO_ENCONTRADO';
  if (status) return 'VISION_UPSTREAM_ERROR';
  if (ES_ERROR_DE_RED.test(String(error?.message ?? ''))) return 'VISION_RED';
  return 'VISION_ERROR_DESCONOCIDO';
}

const STATUS_TRANSITORIOS = new Set([429, 500, 502, 503, 504]);
function esTransitorio(error) {
  if (error?.visionCode === 'VISION_TIMEOUT') return true;
  if (STATUS_TRANSITORIOS.has(statusDe(error))) return true;
  return ES_ERROR_DE_RED.test(String(error?.message ?? ''));
}

function esFatal(error) {
  const status = statusDe(error);
  return status === 401 || status === 403; // la clave no sirve: otro modelo tampoco ayudará
}

function fallo(error) {
  return {
    ok: false,
    error_code: codigoDeError(error),
    mensaje: String(error?.message ?? 'Error desconocido').slice(0, 300),
  };
}

// ───────────────────────────── Utilidades ─────────────────────────────
let client = null;
function getClient() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

function detectMimeType(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return 'image/jpeg';
}

function parseJson(text) {
  try {
    return JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch (error) {
    throw visionError('VISION_INVALID_RESPONSE', 'La respuesta del modelo no es JSON válido', error);
  }
}

// CORRECCIÓN 2: valida en lugar de dejar pasar valores inventados o NaN.
function normalizar(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw visionError('VISION_INVALID_RESPONSE', 'La respuesta del modelo no es un objeto JSON');
  }

  const tipo = String(raw.tipo_desperfecto ?? '').trim().toLowerCase();
  const severidad = String(raw.severidad_sugerida ?? '').trim().toLowerCase();
  const bruta = typeof raw.confianza === 'string' && raw.confianza.trim() !== '' ? Number(raw.confianza) : raw.confianza;

  if (!TIPOS_DESPERFECTO.includes(tipo)) {
    throw visionError('VISION_INVALID_RESPONSE', `tipo_desperfecto inválido: "${tipo}"`);
  }
  if (!SEVERIDADES.includes(severidad)) {
    throw visionError('VISION_INVALID_RESPONSE', `severidad_sugerida inválida: "${severidad}"`);
  }
  if (typeof bruta !== 'number' || !Number.isFinite(bruta)) {
    throw visionError('VISION_INVALID_RESPONSE', 'confianza no es un número válido');
  }
  // Se rechaza en lugar de "recortar": un 85 (porcentaje) recortado a 1 sería engañoso.
  if (bruta < 0 || bruta > 1) {
    throw visionError('VISION_INVALID_RESPONSE', `confianza fuera de rango [0,1]: ${bruta}`);
  }

  return { tipo_desperfecto: tipo, severidad_sugerida: severidad, confianza: bruta };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ───────────────────────────── API pública ─────────────────────────────
/**
 * Analiza una fotografía con Gemini. NUNCA lanza: siempre devuelve un sobre.
 *
 *  Éxito:  { ok: true,  analisis: { tipo_desperfecto, severidad_sugerida, confianza, proveedor, modelo } }
 *  Fallo:  { ok: false, error_code, mensaje }
 *
 * error_code posibles: VISION_DESHABILITADA, VISION_SIN_CLAVE, VISION_ARCHIVO_ILEGIBLE,
 * VISION_TIMEOUT, VISION_UPSTREAM_503, VISION_UPSTREAM_429, VISION_UPSTREAM_ERROR,
 * VISION_MODELO_NO_ENCONTRADO, VISION_AUTH, VISION_RED, VISION_INVALID_RESPONSE,
 * VISION_ERROR_DESCONOCIDO.
 *
 * @param {string} imagePath Ruta de la imagen persistida en disco.
 */
async function analyzeImage(imagePath) {
  try {
    if (process.env.VISION_ENABLED === 'false') {
      return { ok: false, error_code: 'VISION_DESHABILITADA', mensaje: 'La visión artificial está deshabilitada' };
    }
    if (!process.env.GEMINI_API_KEY) {
      return { ok: false, error_code: 'VISION_SIN_CLAVE', mensaje: 'GEMINI_API_KEY no está configurada' };
    }

    // CORRECCIÓN 3: la lectura del archivo queda dentro del try y devuelve su propio error_code.
    let bytes;
    try {
      bytes = await fs.readFile(imagePath);
    } catch (error) {
      console.error(`[VisionService] No se pudo leer la imagen: ${error.code || error.message}`);
      return {
        ok: false,
        error_code: 'VISION_ARCHIVO_ILEGIBLE',
        mensaje: `No se pudo leer la imagen (${error.code || error.message})`,
      };
    }

    const mimeType = detectMimeType(bytes);
    const base64Data = bytes.toString('base64');
    let ultimoError = null;

    for (const modelName of MODEL_CHAIN) {
      for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const model = getClient().getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          });
          const result = await model.generateContent(
            [PROMPT, { inlineData: { data: base64Data, mimeType } }],
            { signal: controller.signal }
          );
          clearTimeout(timer);
          const analisis = normalizar(parseJson(result.response.text()));
          return { ok: true, analisis: { ...analisis, proveedor: PROVIDER, modelo: modelName } };
        } catch (error) {
          const abortado = controller.signal.aborted;
          clearTimeout(timer);
          ultimoError = abortado
            ? visionError('VISION_TIMEOUT', `Timeout de ${TIMEOUT_MS} ms con ${modelName}`, error)
            : error;
          console.error(`[VisionService] ${modelName} intento ${intento}/${MAX_INTENTOS}: ${codigoDeError(ultimoError)} - ${ultimoError.message}`);

          if (esFatal(ultimoError)) return fallo(ultimoError);
          if (!esTransitorio(ultimoError) || intento >= MAX_INTENTOS) break; // siguiente modelo
          await sleep(Math.pow(2, intento) * BACKOFF_BASE_MS + Math.random() * 500);
        }
      }
    }
    return fallo(ultimoError ?? new Error('Sin modelos configurados'));
  } catch (error) {
    // Red de seguridad: ningún fallo inesperado debe escapar de este servicio.
    console.error(`[VisionService] Error inesperado: ${error.message}`);
    return fallo(error);
  }
}

module.exports = { analyzeImage };
