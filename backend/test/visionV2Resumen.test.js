'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepararDeteccionesPersistencia } = require('../src/services/visionV2Resumen');
const { calcularPrioridad } = require('../src/services/priorityService');

const reporte = {
  severidad: 'media', concurrencia_vial: 'baja', infraestructura_critica: 'ninguna',
  clasificacion_vial_estado: 'pendiente', clasificacion_vial: null,
};
const metadatos = { proveedor: 'Roboflow-RFDETR-V2', tipo_desperfecto: 'bache',
  confianza: 0.9, severidad_sugerida: null, baches_candidatos: 2,
  area_visual_pct_union: 17.23, ancho_imagen: 1920, alto_imagen: 1080,
  detecciones: [
    { etiqueta: 'bache', confianza: 0.9, severidad_sugerida: null, area_visual_pct: 11, caja: {x_min: 20, y_min: 50, x_max: 500, y_max: 400}},
    { etiqueta: 'bache', confianza: 0.75, severidad_sugerida: null, area_visual_pct: 9, caja: {x_min: 410, y_min: 240, x_max: 830, y_max: 650}},
  ],
};

test('V2 conserva area de union sin sumar areas solapadas', () => {
  const before = JSON.stringify(metadatos);
  const det = prepararDeteccionesPersistencia(metadatos);
  assert.equal(det.length, 2);
  assert.equal(det[0].resumen_visual.area_visual_pct_union, 17.23);
  assert.equal(det[0].resumen_visual.baches_candidatos, 2);
  assert.equal(det[0].resumen_visual.area_m2, null);
  assert.equal(det[0].resumen_visual.puntos_ia, 0);
  assert.equal(JSON.stringify(metadatos), before, 'no debe mutar los resultados originales');
  assert.equal(det[1].resumen_visual, undefined);
});

test('Una imagen sin detecciones persiste ninguno y area visual cero', () => {
  const det = prepararDeteccionesPersistencia({ ...metadatos,
    tipo_desperfecto:'ninguno', confianza:0, detecciones:[], baches_candidatos:0, area_visual_pct_union:0 });
  assert.equal(det.length, 1);
  assert.equal(det[0].etiqueta, 'ninguno');
  assert.equal(det[0].resumen_visual.area_visual_pct_union, 0);
  assert.equal(det[0].resumen_visual.puntos_ia, 0);
});

test('No se cambia la persistencia del modelo de Bastian', () => {
  const legacy = { proveedor:'TensorFlow-Local', tipo_desperfecto:'bache', confianza:.8,
    detecciones:[{etiqueta:'bache', confianza:.8, severidad_sugerida:null}]};
  assert.deepEqual(prepararDeteccionesPersistencia(legacy), legacy.detecciones);
  assert.deepEqual(prepararDeteccionesPersistencia({ ...legacy, detecciones:[] }),
    [{etiqueta:'bache', confianza:.8, caja:null, severidad_sugerida:null}]);
});

test('Rechaza porcentajes y metadatos inválidos sin inventar tamaño', () => {
  const det = prepararDeteccionesPersistencia({ ...metadatos, area_visual_pct_union: 999,
    ancho_imagen:-5, alto_imagen:'bad', baches_candidatos:999999 });
  assert.equal(det[0].resumen_visual.area_visual_pct_union, null);
  assert.equal(det[0].resumen_visual.baches_candidatos, null);
  assert.equal(det[0].resumen_visual.ancho_imagen, null);
  assert.equal(det[0].resumen_visual.alto_imagen, null);
});

test('RF-DETR no asigna ningun punto ni modifica prioridad, incluso con area visual grande', () => {
  const det = prepararDeteccionesPersistencia({ ...metadatos, area_visual_pct_union: 95 });
  const sin = calcularPrioridad(reporte, null, { ahora: new Date('2026-11-15T12:00:00Z') });
  const conIA = calcularPrioridad(reporte, { estado:'completado', proveedor:'Roboflow-RFDETR-V2',
    detecciones: det }, { ahora: new Date('2026-11-15T12:00:00Z') });
  assert.equal(conIA.puntaje, sin.puntaje);
  assert.equal(conIA.prioridad, sin.prioridad);
  assert.ok(!conIA.antecedentes.some(a => a.factor==='analisis_imagen' && a.puntos !== 0));
});
