import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetricas, barridoUmbrales } from './metricas.mjs';

test('matriz de confusión y métricas usan únicamente casos OK', () => {
  const filas = [
    { id: 'B09', estado: 'OK', bache_real: true, bache_predicho: true },
    { id: 'B10', estado: 'OK', bache_real: true, bache_predicho: false },
    { id: 'G02', estado: 'OK', bache_real: false, bache_predicho: true },
    { id: 'N01', estado: 'OK', bache_real: false, bache_predicho: false },
    { id: 'ERR', estado: 'ERROR', bache_real: false, bache_predicho: false },
  ];
  const r = calcularMetricas(filas);
  assert.deepEqual([r.TP, r.FP, r.TN, r.FN], [1, 1, 1, 1]);
  assert.equal(r.fallidas, 1);
  assert.equal(r.precision, 0.5);
  assert.deepEqual(r.falsos_positivos, ['G02']);
});

test('umbrales experimentales no alteran los datos originales', () => {
  const filas = [
    { id: 'B09', estado: 'OK', bache_real: true, bache_predicho: true, puntaje_bache: 0.96 },
    { id: 'G02', estado: 'OK', bache_real: false, bache_predicho: true, puntaje_bache: 0.91 },
  ];
  const r = barridoUmbrales(filas, [0.9, 0.95]);
  assert.equal(r[0].FP, 1);
  assert.equal(r[1].FP, 0);
  assert.equal(filas[1].bache_predicho, true);
});
