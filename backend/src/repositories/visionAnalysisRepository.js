import { insertAuditEvent } from './auditRepository.js';
import {
  RepositoryConflictError,
  RepositoryForbiddenError,
  RepositoryNotFoundError,
  RepositoryValidationError,
} from './repositoryErrors.js';

const ANALYSIS_STATES = new Set(['pendiente', 'procesando', 'completado', 'fallido']);
const ACTOR_TYPES = new Set(['funcionario', 'sistema']);

function positiveInteger(value, field) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) {
    throw new RepositoryValidationError(`${field} debe ser un entero positivo.`, field);
  }
  return result;
}

function scopeClause(scope, values, reportAlias = 'r') {
  if (scope?.rol === 'superadministrador') return '';
  if (!['inspector', 'administrador_municipal'].includes(scope?.rol)) {
    throw new RepositoryForbiddenError('Se requiere un funcionario municipal autenticado.');
  }
  const municipalityId = positiveInteger(scope.municipalidad_id, 'municipalidad_id');
  values.push(municipalityId);
  return ` AND ${reportAlias}.municipalidad_id = $${values.length}`;
}

function normalizeActor(actor = { tipo_actor: 'sistema', actor_user_id: null }) {
  const normalized = {
    tipo_actor: actor.tipo_actor ?? 'sistema',
    actor_user_id: actor.actor_user_id ?? null,
    request_id: actor.request_id ?? null,
  };
  if (!ACTOR_TYPES.has(normalized.tipo_actor)) {
    throw new RepositoryValidationError('tipo_actor debe ser funcionario o sistema.', 'tipo_actor');
  }
  if (normalized.tipo_actor === 'funcionario' && (!Number.isInteger(Number(normalized.actor_user_id)) || Number(normalized.actor_user_id) < 1)) {
    throw new RepositoryValidationError('El actor funcionario requiere actor_user_id.', 'actor_user_id');
  }
  if (normalized.tipo_actor === 'sistema' && normalized.actor_user_id != null) {
    throw new RepositoryValidationError('El actor sistema no debe incluir actor_user_id.', 'actor_user_id');
  }
  return normalized;
}

function validateCreateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RepositoryValidationError('Los datos del análisis son obligatorios.');
  }
  const reporteId = positiveInteger(input.reporte_id, 'reporte_id');
  const estado = input.estado ?? 'completado';
  if (!ANALYSIS_STATES.has(estado)) {
    throw new RepositoryValidationError('estado de análisis no es válido.', 'estado');
  }
  const detecciones = input.detecciones ?? [];
  if (!Array.isArray(detecciones)) {
    throw new RepositoryValidationError('detecciones debe ser un arreglo JSON.', 'detecciones');
  }
  for (const [field, maxLength] of [['proveedor', 100], ['modelo', 200], ['version_modelo', 100], ['error_code', 80]]) {
    const value = input[field];
    if (value != null && (typeof value !== 'string' || value.length > maxLength)) {
      throw new RepositoryValidationError(`${field} debe ser texto de hasta ${maxLength} caracteres o null.`, field);
    }
  }
  if (estado === 'completado' && (!input.proveedor || !input.modelo || !input.analizado_at)) {
    throw new RepositoryValidationError('Un análisis completado requiere proveedor, modelo y analizado_at.');
  }
  if (estado === 'fallido' && !input.error_code) {
    throw new RepositoryValidationError('Un análisis fallido requiere error_code.', 'error_code');
  }
  const analizadoAt = input.analizado_at == null ? null : new Date(input.analizado_at);
  if (analizadoAt && Number.isNaN(analizadoAt.getTime())) {
    throw new RepositoryValidationError('analizado_at debe ser una fecha válida.', 'analizado_at');
  }
  let deteccionesJson;
  try {
    deteccionesJson = JSON.stringify(detecciones);
  } catch {
    throw new RepositoryValidationError('detecciones debe ser serializable como JSON.', 'detecciones');
  }
  return {
    reporte_id: reporteId,
    proveedor: input.proveedor ?? null,
    modelo: input.modelo ?? null,
    version_modelo: input.version_modelo ?? null,
    estado,
    deteccionesJson,
    error_code: input.error_code ?? null,
    analizado_at: analizadoAt,
  };
}

async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* conservar error original */ }
    throw error;
  } finally {
    client.release();
  }
}

function auditSnapshot(row) {
  return {
    id: row.id,
    reporte_id: row.reporte_id,
    proveedor: row.proveedor,
    modelo: row.modelo,
    version_modelo: row.version_modelo,
    estado: row.estado,
    detecciones_count: Array.isArray(row.detecciones) ? row.detecciones.length : 0,
    error_code: row.error_code,
    analizado_at: row.analizado_at,
  };
}

/**
 * Inserta un análisis asociado a un reporte autorizado.
 * Por defecto el actor es `sistema`, apropiado para la ejecución automática del motor de visión.
 * El ámbito municipal siempre se verifica contra reportes.municipalidad_id.
 */
export async function createVisionAnalysis(
  pool,
  input,
  { scope, actor = { tipo_actor: 'sistema', actor_user_id: null } } = {},
) {
  const data = validateCreateInput(input);
  const auditActor = normalizeActor(actor);
  if (!scope) {
    throw new RepositoryForbiddenError('Se requiere ámbito municipal para crear un análisis.');
  }

  return withTransaction(pool, async (client) => {
    const reportValues = [data.reporte_id];
    const reportScope = scopeClause(scope, reportValues);
    const reportResult = await client.query(
      `SELECT r.id FROM reportes r\n        WHERE r.id = $1 AND r.archivado_at IS NULL${reportScope}\n        FOR SHARE`,
      reportValues,
    );
    if (reportResult.rowCount === 0) {
      throw new RepositoryNotFoundError('Reporte no encontrado o no disponible para este ámbito.');
    }

    const insertResult = await client.query(
      `INSERT INTO analisis_vision\n         (reporte_id, proveedor, modelo, version_modelo, estado, detecciones, error_code, analizado_at)\n       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)\n       RETURNING id, reporte_id, proveedor, modelo, version_modelo, estado, detecciones, error_code, analizado_at, created_at, updated_at`,
      [data.reporte_id, data.proveedor, data.modelo, data.version_modelo, data.estado, data.deteccionesJson, data.error_code, data.analizado_at],
    );
    const row = insertResult.rows[0];

    await insertAuditEvent(client, {
      ...auditActor,
      entidad: 'analisis_vision',
      entidad_id: row.id,
      accion: 'analisis_vision.creado',
      request_id: auditActor.request_id,
      cambios: { after: auditSnapshot(row) },
    });
    return row;
  });
}

const UPDATABLE_FIELDS = ['estado', 'proveedor', 'modelo', 'version_modelo', 'detecciones', 'error_code', 'analizado_at'];

/** Valida la forma de los cambios antes de abrir una transacción. */
function validateUpdateShape(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new RepositoryValidationError('Los cambios del análisis son obligatorios.');
  }
  const keys = Object.keys(changes);
  if (keys.length === 0) {
    throw new RepositoryValidationError('Debe indicar al menos un campo a actualizar.');
  }
  const unknown = keys.filter((key) => !UPDATABLE_FIELDS.includes(key));
  if (unknown.length > 0) {
    throw new RepositoryValidationError(`Campos no editables: ${unknown.join(', ')}.`, unknown[0]);
  }
  if (Object.hasOwn(changes, 'estado') && !ANALYSIS_STATES.has(changes.estado)) {
    throw new RepositoryValidationError('estado de análisis no es válido.', 'estado');
  }
  if (Object.hasOwn(changes, 'detecciones') && !Array.isArray(changes.detecciones)) {
    throw new RepositoryValidationError('detecciones debe ser un arreglo JSON.', 'detecciones');
  }
  for (const [field, maxLength] of [['proveedor', 100], ['modelo', 200], ['version_modelo', 100], ['error_code', 80]]) {
    const value = changes[field];
    if (Object.hasOwn(changes, field) && value != null && (typeof value !== 'string' || value.length > maxLength)) {
      throw new RepositoryValidationError(`${field} debe ser texto de hasta ${maxLength} caracteres o null.`, field);
    }
  }
  if (Object.hasOwn(changes, 'analizado_at') && changes.analizado_at != null && Number.isNaN(new Date(changes.analizado_at).getTime())) {
    throw new RepositoryValidationError('analizado_at debe ser una fecha válida.', 'analizado_at');
  }
}

/**
 * Actualiza un análisis existente (por ejemplo pendiente → completado | fallido).
 * - Verifica el ámbito municipal del reporte asociado y bloquea la fila (FOR UPDATE).
 * - Un análisis `completado` es inmutable: para volver a analizar se crea otro registro.
 * - Si el nuevo estado no es `fallido` y no se envía error_code, este se limpia.
 * - Registra un evento de auditoría con el estado anterior y el nuevo.
 */
export async function updateVisionAnalysis(
  pool,
  id,
  changes,
  { scope, actor = { tipo_actor: 'sistema', actor_user_id: null } } = {},
) {
  const analysisId = positiveInteger(id, 'id');
  validateUpdateShape(changes);
  const auditActor = normalizeActor(actor);
  if (!scope) {
    throw new RepositoryForbiddenError('Se requiere ámbito municipal para actualizar un análisis.');
  }

  return withTransaction(pool, async (client) => {
    const values = [analysisId];
    const scoped = scopeClause(scope, values);
    const currentResult = await client.query(
      `SELECT av.id, av.reporte_id, av.proveedor, av.modelo, av.version_modelo, av.estado,
              av.detecciones, av.error_code, av.analizado_at, av.created_at, av.updated_at
         FROM analisis_vision av
         INNER JOIN reportes r ON r.id = av.reporte_id
        WHERE av.id = $1 AND r.archivado_at IS NULL${scoped}
        FOR UPDATE OF av`,
      values,
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new RepositoryNotFoundError('Análisis no encontrado o no disponible para este ámbito.');
    }
    if (current.estado === 'completado') {
      throw new RepositoryConflictError('Un análisis completado no puede modificarse.');
    }

    const has = (field) => Object.hasOwn(changes, field);
    const estado = has('estado') ? changes.estado : current.estado;
    const next = {
      estado,
      proveedor: has('proveedor') ? changes.proveedor ?? null : current.proveedor,
      modelo: has('modelo') ? changes.modelo ?? null : current.modelo,
      version_modelo: has('version_modelo') ? changes.version_modelo ?? null : current.version_modelo,
      detecciones: has('detecciones') ? changes.detecciones : current.detecciones,
      error_code: has('error_code') ? changes.error_code ?? null : (estado === 'fallido' ? current.error_code : null),
      analizado_at: has('analizado_at')
        ? (changes.analizado_at == null ? null : new Date(changes.analizado_at))
        : current.analizado_at,
    };
    if (next.estado === 'completado' && (!next.proveedor || !next.modelo || !next.analizado_at)) {
      throw new RepositoryValidationError('Un análisis completado requiere proveedor, modelo y analizado_at.');
    }
    if (next.estado === 'fallido' && !next.error_code) {
      throw new RepositoryValidationError('Un análisis fallido requiere error_code.', 'error_code');
    }
    let deteccionesJson;
    try {
      deteccionesJson = JSON.stringify(next.detecciones ?? []);
    } catch {
      throw new RepositoryValidationError('detecciones debe ser serializable como JSON.', 'detecciones');
    }

    const updateResult = await client.query(
      `UPDATE analisis_vision
          SET estado = $2, proveedor = $3, modelo = $4, version_modelo = $5,
              detecciones = $6::jsonb, error_code = $7, analizado_at = $8
        WHERE id = $1
        RETURNING id, reporte_id, proveedor, modelo, version_modelo, estado, detecciones, error_code, analizado_at, created_at, updated_at`,
      [analysisId, next.estado, next.proveedor, next.modelo, next.version_modelo, deteccionesJson, next.error_code, next.analizado_at],
    );
    const row = updateResult.rows[0];

    await insertAuditEvent(client, {
      ...auditActor,
      entidad: 'analisis_vision',
      entidad_id: row.id,
      accion: 'analisis_vision.actualizado',
      request_id: auditActor.request_id,
      cambios: { before: auditSnapshot(current), after: auditSnapshot(row) },
    });
    return row;
  });
}

/** Lista análisis de un reporte, sin revelar datos de reportes de otra municipalidad. */
export async function listVisionAnalysesByReport(pool, reportId, scope) {
  const id = positiveInteger(reportId, 'reporte_id');
  const reportValues = [id];
  const reportScope = scopeClause(scope, reportValues);
  const visibleReport = await pool.query(
    `SELECT r.id FROM reportes r\n      WHERE r.id = $1 AND r.archivado_at IS NULL${reportScope}\n      LIMIT 1`,
    reportValues,
  );
  if (visibleReport.rowCount === 0) return null;

  const result = await pool.query(
    `SELECT av.id, av.reporte_id, av.proveedor, av.modelo, av.version_modelo, av.estado,\n            av.detecciones, av.error_code, av.analizado_at, av.created_at, av.updated_at\n       FROM analisis_vision av\n       INNER JOIN reportes r ON r.id = av.reporte_id\n      WHERE av.reporte_id = $1 AND r.archivado_at IS NULL${scope?.rol === 'superadministrador' ? '' : ' AND r.municipalidad_id = $2'}\n      ORDER BY av.created_at DESC, av.id DESC`,
    [id, ...(scope?.rol === 'superadministrador' ? [] : [positiveInteger(scope?.municipalidad_id, 'municipalidad_id')])],
  );
  return result.rows;
}

/** Obtiene un análisis únicamente si el actor puede consultar el reporte asociado. */
export async function getVisionAnalysisById(pool, analysisId, scope) {
  const id = positiveInteger(analysisId, 'id');
  const values = [id];
  const scoped = scopeClause(scope, values);
  const result = await pool.query(
    `SELECT av.id, av.reporte_id, av.proveedor, av.modelo, av.version_modelo, av.estado,\n            av.detecciones, av.error_code, av.analizado_at, av.created_at, av.updated_at\n       FROM analisis_vision av\n       INNER JOIN reportes r ON r.id = av.reporte_id\n      WHERE av.id = $1 AND r.archivado_at IS NULL${scoped}\n      LIMIT 1`,
    values,
  );
  return result.rows[0] ?? null;
}
