'use strict';

const PROVEEDOR = 'TensorFlow-Local';
const MODELO = 'MobileNetV2-TeachableMachine';

const TIPO_POR_CLASE = Object.freeze({
  bache: 'bache',
  'calle sana': 'ninguno',
  otro: 'ninguno',
});

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const redondear = (n) => Math.round(n * 10000) / 10000;

function interpretarPrediccion(etiquetas, puntajes, { version_modelo = null } = {}) {
  if (!Array.isArray(etiquetas) || etiquetas.length === 0) throw new Error('El modelo no declara etiquetas.');
  if (!puntajes || puntajes.length !== etiquetas.length) throw new Error('Salida del modelo no coincide con etiquetas.');

  const detecciones = etiquetas.map((clase, i) => {
    const confianza = Number(puntajes[i]);
    if (!Number.isFinite(confianza) || confianza < -1e-6 || confianza > 1 + 1e-6) {
      throw new Error(`Puntaje fuera de rango para la clase "${clase}": ${puntajes[i]}`);
    }
    return {
      etiqueta: TIPO_POR_CLASE[normalizar(clase)] ?? 'otro',
      clase_modelo: String(clase),
      confianza: redondear(Math.min(1, Math.max(0, confianza))),
      caja: null, 
      severidad_sugerida: null, // Corregido: ya no inventa severidad "media"
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