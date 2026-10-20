import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveReport,
  createReport,
  getReportById,
  getReportPhotoMetadata,
  listReports,
  updateReport,
} from '../../src/repositories/reportRepository.js';
import {
  MunicipalityCoverageError,
  RepositoryForbiddenError,
  RepositoryValidationError,
} from '../../src/repositories/repositoryErrors.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const SHA = 'a'.repeat(64);

function reportRow(overrides = {}) {
  return {
    id: 42,
    folio: 'BA-2026-000042',
    municipalidad_id: 7,
    latitud: ' -33.582800 '.trim(),
    longitud: '-70.634600',
    precision_ubicacion_m: '8.50',
    metodo_ubicacion: 'gps',
    ubicacion_confirmada: true,
    direccion_detectada: 'Av. Santa Rosa',
    calle_detectada: 'Avenida Santa Rosa',
    comuna_detectada: 'La Pintana',
    region_detectada: 'Región Metropolitana de Santiago',
    estado_geocodificacion: 'resuelta',
    geocodificacion_proveedor: 'test-provider',
    geocodificacion_resuelta_at: NOW,
    estado_asignacion: 'asignado',
    clasificacion_vial: null,
    clasificacion_vial_estado: 'pendiente',
    clasificacion_vial_fuente: null,
    clasificacion_vial_verificada_at: null,
    severidad: 'alta',
    estado: 'pendiente',
    concurrencia_vial: 'muy_alta',
    infraestructura_critica: 'centro_salud',
    descripcion: 'Reporte ficticio de prueba',
    foto_storage_key: 'seed/demo-report-001.png',
    foto_mime_type: 'image/png',
    foto_size_bytes: 3660,
    foto_sha256: SHA,
    foto_ancho_px: 640,
    foto_alto_px: 360,
    archivado_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function createFakeClient({ report = reportRow(), covered = true, selectRows = null } = {}) {
  const calls = [];
  const client = {
    released: false,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (normalized.includes('FROM municipalidades') && normalized.includes('FOR SHARE')) {
        return { rows: covered ? [{ id: 7 }] : [], rowCount: covered ? 1 : 0 };
      }
      if (normalized.startsWith('INSERT INTO reportes')) {
        return { rows: [report], rowCount: 1 };
      }
      if (normalized.startsWith('SELECT r.* FROM reportes r') && normalized.includes('FOR UPDATE')) {
        return { rows: selectRows ?? [report], rowCount: (selectRows ?? [report]).length };
      }
      if (normalized.startsWith('UPDATE reportes r')) {
        const updated = { ...report, estado: params.includes('en_revision') ? 'en_revision' : report.estado, updated_at: new Date('2026-10-20T12:01:00.000Z') };
        return { rows: [updated], rowCount: 1 };
      }
      if (normalized.startsWith('INSERT INTO auditoria_eventos')) {
        return { rows: [{ id: 100, created_at: NOW }], rowCount: 1 };
      }
      throw new Error(`Consulta inesperada en fake client: ${normalized}`);
    },
    release() { this.released = true; },
  };
  return { client, calls };
}

function createFakePool({ report = reportRow(), covered = true, selectRows = null } = {}) {
  const fake = createFakeClient({ report, covered, selectRows });
  const poolCalls = [];
  return {
    ...fake,
    pool: {
      connect: async () => fake.client,
      async query(sql, params = []) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        poolCalls.push({ sql: normalized, params });
        if (normalized.startsWith('SELECT COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 };
        if (normalized.startsWith('SELECT r.* FROM reportes r')) return { rows: [report], rowCount: 1 };
        if (normalized.includes('SELECT r.id, r.foto_storage_key')) {
          return {
            rows: [{
              id: report.id,
              foto_storage_key: report.foto_storage_key,
              foto_mime_type: report.foto_mime_type,
              foto_size_bytes: report.foto_size_bytes,
              foto_sha256: report.foto_sha256,
              foto_ancho_px: report.foto_ancho_px,
              foto_alto_px: report.foto_alto_px,
            }],
            rowCount: 1,
          };
        }
        throw new Error(`Consulta inesperada en fake pool: ${normalized}`);
      },
    },
    poolCalls,
  };
}

function createInput(overrides = {}) {
  return {
    municipalidad_id: 7,
    latitud: -33.5828,
    longitud: -70.6346,
    precision_ubicacion_m: 8.5,
    metodo_ubicacion: 'gps',
    ubicacion_confirmada: true,
    direccion_detectada: 'Av. Santa Rosa',
    calle_detectada: 'Avenida Santa Rosa',
    comuna_detectada: 'La Pintana',
    region_detectada: 'Región Metropolitana de Santiago',
    estado_geocodificacion: 'resuelta',
    geocodificacion_proveedor: 'test-provider',
    geocodificacion_resuelta_at: NOW,
    clasificacion_vial: null,
    clasificacion_vial_estado: 'pendiente',
    severidad: 'alta',
    concurrencia_vial: 'muy_alta',
    infraestructura_critica: 'centro_salud',
    descripcion: 'Reporte ficticio de prueba',
    foto_storage_key: 'seed/demo-report-001.png',
    foto_mime_type: 'image/png',
    foto_size_bytes: 3660,
    foto_sha256: SHA,
    foto_ancho_px: 640,
    foto_alto_px: 360,
    ...overrides,
  };
}

test('createReport inserta el reporte y la auditoría en una transacción', async () => {
  const fake = createFakePool();
  const result = await createReport(fake.pool, createInput());
  assert.equal(result.id, 42);
  assert.equal(result.foto_url, '/api/v1/reportes/42/foto');
  assert.equal('foto_storage_key' in result, false, 'no debe exponer la ruta interna de almacenamiento');
  assert.equal(fake.calls[0].sql, 'BEGIN');
  assert.ok(fake.calls.some((call) => call.sql.startsWith('INSERT INTO reportes')));
  assert.ok(fake.calls.some((call) => call.sql.startsWith('INSERT INTO auditoria_eventos')));
  assert.equal(fake.calls.at(-1).sql, 'COMMIT');
  assert.equal(fake.client.released, true);
});

test('createReport rechaza una municipalidad sin cobertura y revierte la transacción', async () => {
  const fake = createFakePool({ covered: false });
  await assert.rejects(createReport(fake.pool, createInput()), MunicipalityCoverageError);
  assert.ok(fake.calls.some((call) => call.sql === 'ROLLBACK'));
  assert.equal(fake.calls.some((call) => call.sql.startsWith('INSERT INTO reportes')), false);
  assert.equal(fake.client.released, true);
});

test('createReport rechaza coordenadas fuera de rango antes de tocar PostgreSQL', async () => {
  const fake = createFakePool();
  await assert.rejects(createReport(fake.pool, createInput({ latitud: 180 })), RepositoryValidationError);
  assert.equal(fake.calls.length, 0);
});

test('listReports filtra obligatoriamente la municipalidad y pagina de forma estable', async () => {
  const fake = createFakePool();
  const result = await listReports(fake.pool, {
    scope: { rol: 'inspector', municipalidad_id: 7 },
    estado: 'pendiente',
    page: 2,
    limit: 10,
  });
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.limit, 10);
  assert.match(fake.poolCalls[0].sql, /r\.municipalidad_id = \$1/);
  assert.match(fake.poolCalls[1].sql, /ORDER BY r\.created_at DESC, r\.id DESC/);
  assert.deepEqual(fake.poolCalls[1].params.slice(-2), [10, 10]);
});

test('listReports impide a un funcionario filtrar otra municipalidad', async () => {
  const fake = createFakePool();
  await assert.rejects(
    listReports(fake.pool, {
      scope: { rol: 'administrador_municipal', municipalidad_id: 7 },
      municipalidad_id: 8,
    }),
    RepositoryForbiddenError,
  );
  assert.equal(fake.poolCalls.length, 0);
});

test('getReportById aplica ámbito municipal en la consulta', async () => {
  const fake = createFakePool();
  const result = await getReportById(fake.pool, 42, { rol: 'inspector', municipalidad_id: 7 });
  assert.equal(result.id, 42);
  assert.match(fake.poolCalls[0].sql, /r\.municipalidad_id = \$2/);
  assert.deepEqual(fake.poolCalls[0].params, [42, 7]);
});

test('getReportPhotoMetadata devuelve una clave interna solo para una petición autorizada', async () => {
  const fake = createFakePool();
  const result = await getReportPhotoMetadata(fake.pool, 42, { rol: 'inspector', municipalidad_id: 7 });
  assert.equal(result.storage_key, 'seed/demo-report-001.png');
  assert.equal(result.mime_type, 'image/png');
  assert.equal(fake.poolCalls[0].params[1], 7);
});

test('un inspector solo puede actualizar el estado, no la severidad', async () => {
  const fake = createFakePool();
  await assert.rejects(
    updateReport(fake.pool, 42, { severidad: 'baja' }, { rol: 'inspector', municipalidad_id: 7 }, { tipo_actor: 'funcionario', actor_user_id: 10 }),
    RepositoryForbiddenError,
  );
  assert.equal(fake.calls.length, 0);
});

test('archiveReport prohíbe el archivo lógico para inspectores', async () => {
  const fake = createFakePool();
  await assert.rejects(
    archiveReport(fake.pool, 42, { rol: 'inspector', municipalidad_id: 7 }, { tipo_actor: 'funcionario', actor_user_id: 10 }),
    RepositoryForbiddenError,
  );
  assert.equal(fake.calls.length, 0);
});

test('updateReport registra before/after y limita la consulta a la municipalidad', async () => {
  const before = reportRow({ estado: 'pendiente' });
  const fake = createFakePool({ report: before });
  const result = await updateReport(
    fake.pool,
    42,
    { estado: 'en_revision' },
    { rol: 'inspector', municipalidad_id: 7 },
    { tipo_actor: 'funcionario', actor_user_id: 10, request_id: 'req-test-001' },
  );
  assert.equal(result.estado, 'en_revision');
  const selectCall = fake.calls.find((call) => call.sql.startsWith('SELECT r.* FROM reportes r'));
  assert.match(selectCall.sql, /r\.municipalidad_id = \$2/);
  assert.ok(fake.calls.some((call) => call.sql.startsWith('INSERT INTO auditoria_eventos')));
  assert.equal(fake.calls.at(-1).sql, 'COMMIT');
});

test('archivo lógico conserva la fila y registra auditoría', async () => {
  const fake = createFakePool();
  const result = await archiveReport(
    fake.pool,
    42,
    { rol: 'administrador_municipal', municipalidad_id: 7 },
    { tipo_actor: 'funcionario', actor_user_id: 11 },
  );
  assert.equal(result.id, 42);
  assert.ok(fake.calls.some((call) => call.sql.startsWith('UPDATE reportes r SET archivado_at')));
  assert.ok(fake.calls.some((call) => call.sql.startsWith('INSERT INTO auditoria_eventos')));
});

test('modificación administrativa exige un actor funcionario auditable', async () => {
  const fake = createFakePool();
  await assert.rejects(
    updateReport(fake.pool, 42, { estado: 'en_revision' }, { rol: 'administrador_municipal', municipalidad_id: 7 }),
    RepositoryForbiddenError,
  );
  assert.equal(fake.calls.length, 0);
});
