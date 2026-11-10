import test from 'node:test';
import assert from 'node:assert/strict';
import { updateVisionAnalysis } from '../../src/repositories/visionAnalysisRepository.js';
import {
  RepositoryConflictError,
  RepositoryForbiddenError,
  RepositoryNotFoundError,
  RepositoryValidationError,
} from '../../src/repositories/repositoryErrors.js';

const AT = new Date('2026-11-10T12:00:00.000Z');
const scope = { rol: 'administrador_municipal', municipalidad_id: 7 };

const fila = (extra = {}) => ({
  id: 81, reporte_id: 42, proveedor: null, modelo: null, version_modelo: null,
  estado: 'pendiente', detecciones: [], error_code: null, analizado_at: null,
  created_at: AT, updated_at: AT, ...extra,
});

function createFakePool({ actual = fila() } = {}) {
  const calls = [];
  const client = {
    released: false,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [], rowCount: 0 };
      if (normalized.startsWith('SELECT av.id') && normalized.includes('FOR UPDATE OF av')) {
        return { rows: actual ? [actual] : [], rowCount: actual ? 1 : 0 };
      }
      if (normalized.startsWith('UPDATE analisis_vision')) {
        const [id, estado, proveedor, modelo, version_modelo, detecciones, error_code, analizado_at] = params;
        return { rows: [{ ...actual, id, estado, proveedor, modelo, version_modelo, detecciones: JSON.parse(detecciones), error_code, analizado_at }], rowCount: 1 };
      }
      if (normalized.startsWith('INSERT INTO auditoria_eventos')) return { rows: [{ id: 1, created_at: AT }], rowCount: 1 };
      throw new Error(`Consulta inesperada: ${normalized}`);
    },
    release() { this.released = true; },
  };
  return { pool: { connect: async () => client }, calls, client };
}

const completado = (extra = {}) => ({
  estado: 'completado', proveedor: 'google-gemini', modelo: 'gemini-2.5-flash', version_modelo: null,
  detecciones: [{ etiqueta: 'bache', confianza: 0.9 }], error_code: null, analizado_at: AT, ...extra,
});

test('updateVisionAnalysis pasa pendiente → completado con auditoría en una transacción', async () => {
  const fake = createFakePool();
  const result = await updateVisionAnalysis(fake.pool, 81, completado(), { scope });
  assert.equal(result.estado, 'completado');
  assert.equal(result.modelo, 'gemini-2.5-flash');
  assert.equal(fake.calls[0].sql, 'BEGIN');
  assert.match(fake.calls[1].sql, /FOR UPDATE OF av/);
  assert.match(fake.calls[1].sql, /r\.municipalidad_id = \$2/);
  assert.deepEqual(fake.calls[1].params, [81, 7]);
  const audit = fake.calls.find((c) => c.sql.startsWith('INSERT INTO auditoria_eventos'));
  assert.ok(audit.params.includes('analisis_vision.actualizado'));
  assert.equal(fake.calls.at(-1).sql, 'COMMIT');
  assert.equal(fake.client.released, true);
});

test('updateVisionAnalysis registra el fallo con su error_code', async () => {
  const fake = createFakePool();
  const result = await updateVisionAnalysis(fake.pool, 81, { estado: 'fallido', error_code: 'VISION_TIMEOUT' }, { scope });
  assert.equal(result.estado, 'fallido');
  assert.equal(result.error_code, 'VISION_TIMEOUT');
});

test('updateVisionAnalysis limpia error_code al reprocesar un análisis fallido', async () => {
  const fake = createFakePool({ actual: fila({ estado: 'fallido', error_code: 'VISION_UPSTREAM_503' }) });
  const result = await updateVisionAnalysis(fake.pool, 81, { estado: 'procesando' }, { scope });
  assert.equal(result.estado, 'procesando');
  assert.equal(result.error_code, null);
});

test('updateVisionAnalysis no permite modificar un análisis completado', async () => {
  const fake = createFakePool({ actual: fila(completado()) });
  await assert.rejects(updateVisionAnalysis(fake.pool, 81, { estado: 'fallido', error_code: 'X' }, { scope }), RepositoryConflictError);
  assert.ok(fake.calls.some((c) => c.sql === 'ROLLBACK'));
  assert.equal(fake.calls.some((c) => c.sql.startsWith('UPDATE analisis_vision')), false);
  assert.equal(fake.client.released, true);
});

test('updateVisionAnalysis revierte si el análisis no está en el ámbito municipal', async () => {
  const fake = createFakePool({ actual: null });
  await assert.rejects(updateVisionAnalysis(fake.pool, 81, completado(), { scope }), RepositoryNotFoundError);
  assert.ok(fake.calls.some((c) => c.sql === 'ROLLBACK'));
});

test('updateVisionAnalysis exige ámbito municipal', async () => {
  const fake = createFakePool();
  await assert.rejects(updateVisionAnalysis(fake.pool, 81, completado()), RepositoryForbiddenError);
  assert.equal(fake.calls.length, 0);
});

test('updateVisionAnalysis valida los cambios (sin abrir transacción cuando la forma es inválida)', async () => {
  for (const cambios of [null, [], {}, { reporte_id: 5 }, { estado: 'terminado' }, { detecciones: {} }, { modelo: 'x'.repeat(201) }, { analizado_at: 'no-fecha' }]) {
    const fake = createFakePool();
    await assert.rejects(updateVisionAnalysis(fake.pool, 81, cambios, { scope }), RepositoryValidationError, JSON.stringify(cambios));
    assert.equal(fake.calls.length, 0);
  }
  await assert.rejects(updateVisionAnalysis(createFakePool().pool, 0, completado(), { scope }), RepositoryValidationError);
});

test('updateVisionAnalysis exige los datos mínimos de completado y fallido', async () => {
  const a = createFakePool();
  await assert.rejects(updateVisionAnalysis(a.pool, 81, { estado: 'completado' }, { scope }), RepositoryValidationError);
  assert.ok(a.calls.some((c) => c.sql === 'ROLLBACK'));
  const b = createFakePool();
  await assert.rejects(updateVisionAnalysis(b.pool, 81, { estado: 'fallido' }, { scope }), RepositoryValidationError);
});
