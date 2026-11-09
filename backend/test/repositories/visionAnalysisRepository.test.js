import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVisionAnalysis,
  getVisionAnalysisById,
  listVisionAnalysesByReport,
} from '../../src/repositories/visionAnalysisRepository.js';
import {
  RepositoryForbiddenError,
  RepositoryNotFoundError,
  RepositoryValidationError,
} from '../../src/repositories/repositoryErrors.js';

const CREATED_AT = new Date('2026-11-09T12:00:00.000Z');
const ANALYSIS = {
  id: 81,
  reporte_id: 42,
  proveedor: 'Anthropic',
  modelo: 'Claude Vision',
  version_modelo: '2026-11',
  estado: 'completado',
  detecciones: [{ etiqueta: 'bache', confianza: 0.94, caja: { x: 0.1, y: 0.2, ancho: 0.3, alto: 0.4 } }],
  error_code: null,
  analizado_at: CREATED_AT,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
};

function createFakePool({ reportVisible = true } = {}) {
  const calls = [];
  const poolCalls = [];
  const client = {
    released: false,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [], rowCount: 0 };
      if (normalized.startsWith('SELECT r.id FROM reportes')) {
        return { rows: reportVisible ? [{ id: 42 }] : [], rowCount: reportVisible ? 1 : 0 };
      }
      if (normalized.startsWith('INSERT INTO analisis_vision')) {
        return { rows: [ANALYSIS], rowCount: 1 };
      }
      if (normalized.startsWith('INSERT INTO auditoria_eventos')) {
        return { rows: [{ id: 120, created_at: CREATED_AT }], rowCount: 1 };
      }
      throw new Error(`Consulta inesperada en fake client: ${normalized}`);
    },
    release() { this.released = true; },
  };
  const pool = {
    connect: async () => client,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      poolCalls.push({ sql: normalized, params });
      if (normalized.startsWith('SELECT r.id FROM reportes')) {
        return { rows: [{ id: 42 }], rowCount: 1 };
      }
      if (normalized.startsWith('SELECT av.id') && normalized.includes('WHERE av.reporte_id = $1')) {
        return { rows: [ANALYSIS], rowCount: 1 };
      }
      if (normalized.startsWith('SELECT av.id') && normalized.includes('WHERE av.id = $1')) {
        return { rows: [ANALYSIS], rowCount: 1 };
      }
      throw new Error(`Consulta inesperada en fake pool: ${normalized}`);
    },
  };
  return { pool, calls, poolCalls, client };
}

const completeInput = (overrides = {}) => ({
  reporte_id: 42,
  proveedor: 'Anthropic',
  modelo: 'Claude Vision',
  version_modelo: '2026-11',
  estado: 'completado',
  detecciones: [{ etiqueta: 'bache', confianza: 0.94 }],
  analizado_at: CREATED_AT,
  ...overrides,
});

const scope = { rol: 'administrador_municipal', municipalidad_id: 7 };

test('createVisionAnalysis inserta el análisis y auditoría en una misma transacción', async () => {
  const fake = createFakePool();
  const result = await createVisionAnalysis(fake.pool, completeInput(), { scope });
  assert.equal(result.id, 81);
  assert.equal(result.reporte_id, 42);
  assert.equal(fake.calls[0].sql, 'BEGIN');
  assert.match(fake.calls[1].sql, /FROM reportes r/);
  assert.match(fake.calls[1].sql, /r\.municipalidad_id = \$2/);
  assert.ok(fake.calls.some((call) => call.sql.startsWith('INSERT INTO analisis_vision')));
  assert.ok(fake.calls.some((call) => call.sql.startsWith('INSERT INTO auditoria_eventos')));
  assert.equal(fake.calls.at(-1).sql, 'COMMIT');
  assert.equal(fake.client.released, true);
});

test('createVisionAnalysis revierte si el reporte no pertenece al ámbito municipal', async () => {
  const fake = createFakePool({ reportVisible: false });
  await assert.rejects(
    createVisionAnalysis(fake.pool, completeInput(), { scope }),
    RepositoryNotFoundError,
  );
  assert.ok(fake.calls.some((call) => call.sql === 'ROLLBACK'));
  assert.equal(fake.calls.some((call) => call.sql.startsWith('INSERT INTO analisis_vision')), false);
  assert.equal(fake.client.released, true);
});

test('createVisionAnalysis exige ámbito municipal', async () => {
  const fake = createFakePool();
  await assert.rejects(
    createVisionAnalysis(fake.pool, completeInput()),
    RepositoryForbiddenError,
  );
  assert.equal(fake.calls.length, 0);
});

test('createVisionAnalysis valida detecciones como arreglo', async () => {
  const fake = createFakePool();
  await assert.rejects(
    createVisionAnalysis(fake.pool, completeInput({ detecciones: { etiqueta: 'bache' } }), { scope }),
    RepositoryValidationError,
  );
  assert.equal(fake.calls.length, 0);
});

test('listVisionAnalysesByReport filtra por municipalidad del reporte', async () => {
  const fake = createFakePool();
  const results = await listVisionAnalysesByReport(fake.pool, 42, scope);
  assert.equal(results.length, 1);
  assert.match(fake.poolCalls[0].sql, /r\.municipalidad_id = \$2/);
  assert.deepEqual(fake.poolCalls[0].params, [42, 7]);
  assert.match(fake.poolCalls[1].sql, /r\.municipalidad_id = \$2/);
  assert.deepEqual(fake.poolCalls[1].params, [42, 7]);
});

test('getVisionAnalysisById filtra por municipalidad del reporte asociado', async () => {
  const fake = createFakePool();
  const result = await getVisionAnalysisById(fake.pool, 81, scope);
  assert.equal(result.id, 81);
  assert.match(fake.poolCalls[0].sql, /r\.municipalidad_id = \$2/);
  assert.deepEqual(fake.poolCalls[0].params, [81, 7]);
});

test('consultas de visión rechazan roles sin ámbito municipal', async () => {
  const fake = createFakePool();
  await assert.rejects(listVisionAnalysesByReport(fake.pool, 42, { rol: 'invitado' }), RepositoryForbiddenError);
  assert.equal(fake.poolCalls.length, 0);
});
