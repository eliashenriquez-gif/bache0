'use strict';

/**
 * Reglas del motor de prioridad de Bache 0.
 *
 * IMPORTANTE: estos puntos y umbrales son REGLAS INICIALES DEL PROTOTIPO.
 * No corresponden a criterios oficiales de ninguna municipalidad ni han sido
 * calibrados con datos reales. Cualquier cambio debe subir VERSION_REGLAS.
 *
 * Este archivo solo contiene datos; la lógica vive en priorityService.js.
 */

const VERSION_REGLAS = 'prototipo-v1';

// Valores admitidos según el contrato API v1 y el esquema SQL.
const PUNTOS = {
  // Evidencia directa del daño: es el factor de mayor peso.
  severidad: { baja: 0, media: 2, alta: 4 },
  // Más personas expuestas al desperfecto.
  concurrencia_vial: { baja: 0, media: 1, alta: 2, muy_alta: 3 },
  // Entornos con población vulnerable o de afluencia masiva.
  infraestructura_critica: {
    ninguna: 0,
    otra: 1,
    colegio: 2,
    centro_salud: 2,
    estacion_terminal: 2,
  },
  // Solo cuenta si la clasificación está confirmada con fuente verificable.
  // Se mantiene bajo para no duplicar el efecto de la concurrencia vial.
  clasificacion_vial: { local: 0, servicio: 0, colectora: 1, troncal: 2, expresa: 2 },
};

// Aporte de la visión artificial: complementario, acotado y que nunca resta.
const IA = {
  puntos_maximos: 1,
  // La confianza que declara el modelo no está calibrada: se usa un umbral
  // moderado y el aporte es pequeño por diseño.
  confianza_minima: 0.6,
  severidad_que_suma: 'alta',
  tipos_que_corroboran: [
    'bache',
    'grieta_longitudinal',
    'grieta_transversal',
    'grieta_piel_de_cocodrilo',
  ],
  tipos_validos: [
    'bache',
    'grieta_longitudinal',
    'grieta_transversal',
    'grieta_piel_de_cocodrilo',
    'otro',
    'ninguno',
  ],
  severidades_validas: ['baja', 'media', 'alta'],
  // Proveedores cuyo resultado no es un análisis real y debe ignorarse.
  proveedores_ignorados_prefijo: 'mock',
};

// Puntaje mínimo (inclusive) para alcanzar cada nivel.
const UMBRALES = { alta: 6, media: 3 };

const ORDEN_SEVERIDAD = ['baja', 'media', 'alta'];

const FUNDAMENTOS = {
  severidad: 'Evidencia directa del daño; por eso es el factor con mayor peso.',
  concurrencia_vial: 'A mayor flujo de personas y vehículos, mayor exposición al desperfecto.',
  infraestructura_critica: 'Colegios, centros de salud y terminales concentran población vulnerable o masiva.',
  clasificacion_vial: 'Las vías de mayor jerarquía tienen mayor velocidad y flujo; peso bajo para no duplicar la concurrencia.',
  ia: 'Apoyo complementario con tope +1: corrobora, nunca decide ni resta puntos.',
  umbrales: 'Regla inicial del prototipo: Alta desde 6 puntos, Media desde 3, Baja bajo 3.',
};

function profundoCongelado(objeto) {
  Object.values(objeto).forEach((valor) => {
    if (valor && typeof valor === 'object') profundoCongelado(valor);
  });
  return Object.freeze(objeto);
}

module.exports = profundoCongelado({
  VERSION_REGLAS,
  PUNTOS,
  IA,
  UMBRALES,
  ORDEN_SEVERIDAD,
  FUNDAMENTOS,
});
