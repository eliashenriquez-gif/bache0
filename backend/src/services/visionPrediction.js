'use strict';

/**
 * Traducción PURA (sin TensorFlow ni sharp) de las probabilidades del modelo al
 * contrato de dominio de Bache 0. Vive aparte del worker para poder probarla sin
 * cargar el modelo y para que el worker quede reducido a "tensor in → números out".
 *
 * Principios (contrato 11):
 *  - El modelo solo clasifica la FOTO en tres clases (Bache / Calle Sana / Otro).
 *    No estima profundidad, diámetro ni severidad: por eso `severidad_sugerida`
 *    es siempre null. Inventarla (antes se fijaba en "media") generaba falsas
 *    advertencias de discrepancia con la severidad declarada por el ciudadano.
 *  - No se descarta información: si la confianza es baja se informa la clase real
 *    con su confianza y es el motor de prioridad (priorityRules.IA.confianza_minima)
 *    quien decide que "no aporta".
 */

const PROVEEDOR = 'TensorFlow-Local';
const MODELO = 'MobileNetV2-TeachableMachine';

// Clase del modelo (normalizada) → tipo de desperfecto del dominio.
// "Otro" se informa como "ninguno": el motor lo trata como "no se detectó desperfecto"
// y agrega la advertencia `revisar_fotografia` (la foto puede no ser de una calzada).
const TIPO_POR_CLASE = Object.freeze({
  bache: 'bache',
  'calle sana': 'ninguno',
  otro: 'ninguno',
});

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const redondear = (n) => Math.round(n * 10000) / 10000;

/**
 * @param {string[]} etiquetas Clases del modelo (metadata.json → labels).
 * @param {ArrayLike<number>} puntajes Salida softmax del modelo, mismo orden que las etiquetas.
 * @param {{version_modelo?: string|null}} [opciones]
 */
function interpretarPrediccion(etiquetas, puntajes, { version_modelo = null } = {}) {
  if (!Array.isArray(etiquetas) || etiquetas.length === 0) {
    throw new Error('El modelo no declara etiquetas (metadata.json).');
  }
  if (!puntajes || puntajes.length !== etiquetas.length) {
    throw new Error(
      `La salida del modelo (${puntajes?.length ?? 0}) no coincide con las etiquetas (${etiquetas.length}).`
    );
  }

  const detecciones = etiquetas.map((clase, i) => {
    const confianza = Number(puntajes[i]);
    if (!Number.isFinite(confianza) || confianza < -1e-6 || confianza > 1 + 1e-6) {
      throw new Error(`Puntaje fuera de rango para la clase "${clase}": ${puntajes[i]}`);
    }
    return {
      etiqueta: TIPO_POR_CLASE[normalizar(clase)] ?? 'otro', // clase desconocida (reentrenamiento): no suma puntos
      clase_modelo: String(clase),
      confianza: redondear(Math.min(1, Math.max(0, confianza))),
      caja: null, // clasificación de imagen completa: sin bounding box
      severidad_sugerida: null,
    };
  });

  detecciones.sort((a, b) => b.confianza - a.confianza);
  const mejor = detecciones[0];

  return {
    tipo_desperfecto: mejor.etiqueta,
    severidad_sugerida: null,
    confianza: mejor.confianza,
    proveedor: PROVEEDOR,
    modelo: MODELO,
    version_modelo,
    detecciones,
  };
}

module.exports = { interpretarPrediccion, PROVEEDOR, MODELO, TIPO_POR_CLASE };
