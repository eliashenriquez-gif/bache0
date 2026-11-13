'use strict';

// node --test test/visionPrediction.test.js  — sin TensorFlow ni sharp.
const test = require('node:test');
const assert = require('node:assert/strict');
const { interpretarPrediccion, PROVEEDOR, MODELO } = require('../src/services/visionPrediction');
const { calcularPrioridad } = require('../src/services/priorityService');

const ETIQUETAS = ['Bache', 'Calle Sana', 'Otro']; // src/models/vision/metadata.json

test('la clase "Bache" se traduce a "bache" y es la mejor detección', () => {
  const r = interpretarPrediccion(ETIQUETAS, [0.91, 0.06, 0.03], { version_modelo: 'v-test' });
  assert.equal(r.tipo_desperfecto, 'bache');
  assert.equal(r.confianza, 0.91);
  assert.equal(r.proveedor, PROVEEDOR);
  assert.equal(r.modelo, MODELO);
  assert.equal(r.version_modelo, 'v-test');
  assert.deepEqual(r.detecciones.map((d) => d.clase_modelo), ['Bache', 'Calle Sana', 'Otro']);
});

test('"Calle Sana" y "Otro" se informan como "ninguno" (sin desperfecto)', () => {
  assert.equal(interpretarPrediccion(ETIQUETAS, [0.1, 0.8, 0.1]).tipo_desperfecto, 'ninguno');
  assert.equal(interpretarPrediccion(ETIQUETAS, [0.1, 0.1, 0.8]).tipo_desperfecto, 'ninguno');
});

test('el modelo NO estima severidad: severidad_sugerida es siempre null (no se inventa "media")', () => {
  const r = interpretarPrediccion(ETIQUETAS, [0.95, 0.03, 0.02]);
  assert.equal(r.severidad_sugerida, null);
  assert.ok(r.detecciones.every((d) => d.severidad_sugerida === null && d.caja === null));
});

test('las detecciones salen ordenadas por confianza y no se descarta información de baja confianza', () => {
  const r = interpretarPrediccion(ETIQUETAS, [0.4, 0.35, 0.25]);
  assert.deepEqual(r.detecciones.map((d) => d.confianza), [0.4, 0.35, 0.25]);
  assert.equal(r.tipo_desperfecto, 'bache'); // la decisión de "confianza insuficiente" es del motor de prioridad
});

test('una clase desconocida (modelo reentrenado) se informa como "otro" y no suma puntos', () => {
  const r = interpretarPrediccion(['Bache', 'Grieta nueva'], [0.2, 0.8]);
  assert.equal(r.tipo_desperfecto, 'otro');
});

test('las etiquetas se comparan sin tildes ni mayúsculas', () => {
  assert.equal(interpretarPrediccion(['BACHÉ', 'calle  sana'.replace('  ', ' ')], [0.7, 0.3]).tipo_desperfecto, 'bache');
});

test('entradas inconsistentes lanzan error (el worker lo informa como fallo, no como dato falso)', () => {
  assert.throws(() => interpretarPrediccion([], []), /etiquetas/);
  assert.throws(() => interpretarPrediccion(ETIQUETAS, [0.5, 0.5]), /no coincide/);
  assert.throws(() => interpretarPrediccion(ETIQUETAS, [0.5, NaN, 0.5]), /fuera de rango/);
  assert.throws(() => interpretarPrediccion(ETIQUETAS, [1.7, 0, 0]), /fuera de rango/);
});

test('contrato con el motor de prioridad: el análisis real del modelo es aceptado y hoy aporta +0', () => {
  const r = interpretarPrediccion(ETIQUETAS, [0.97, 0.02, 0.01]);
  const reporte = { severidad: 'alta', concurrencia_vial: 'media', infraestructura_critica: 'ninguna', clasificacion_vial: null, clasificacion_vial_estado: 'pendiente' };
  const sinIA = calcularPrioridad(reporte, null);
  const conIA = calcularPrioridad(reporte, { estado: 'completado', proveedor: r.proveedor, modelo: r.modelo, detecciones: r.detecciones });
  assert.equal(conIA.puntaje, sinIA.puntaje);
  // Sin severidad_sugerida no hay advertencias de "discrepancia" falsas:
  assert.ok(!conIA.advertencias.some((a) => a.startsWith('discrepancia_severidad')));
  assert.ok(!conIA.datos_no_disponibles.includes('analisis_imagen'));
});
