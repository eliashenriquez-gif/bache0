import { insertAuditEvent } from './auditRepository.js';
import {
  MunicipalityCoverageError,
  RepositoryForbiddenError,
  RepositoryValidationError,
} from './repositoryErrors.js';

const SEVERITIES = new Set(['baja', 'media', 'alta']);
const STATUSES = new Set(['pendiente', 'en_revision', 'reparado']);
const TRAFFIC_LEVELS = new Set(['baja', 'media', 'alta', 'muy_alta']);
const INFRASTRUCTURE_TYPES = new Set(['ninguna', 'colegio', 'centro_salud', 'estacion_terminal', 'otra']);
const LOCATION_METHODS = new Set(['gps', 'pin_manual']);
const GEOCODING_STATES = new Set(['resuelta', 'parcial']);
const ROAD_CLASSES = new Set(['expresa', 'troncal', 'colectora', 'servicio', 'local']);
const ROAD_CLASS_STATES = new Set(['confirmada', 'ambigua', 'pendiente', 'no_disponible']);
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const UPDATE_COLUMN_BY_FIELD = Object.freeze({
  severidad: 'severidad',
  estado: 'estado',
  concurrencia_vial: 'concurrencia_vial',
  infraestructura_critica: 'infraestructura_critica',
  descripcion: 'descripcion',
});

function positiveInteger(value, field) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) {
    throw new RepositoryValidationError(`${field} debe ser un entero positivo.`, field);
  }
  return result;
}

function reportScopeClause(scope, values, tableAlias = 'r') {
  if (scope?.rol === 'superadministrador') return '';
  if (!['inspector', 'administrador_municipal'].includes(scope?.rol)) {
    throw new RepositoryForbiddenError('Se requiere un funcionario municipal autenticado.');
  }
  const municipalityId = positiveInteger(scope?.municipalidad_id, 'municipalidad_id');
  values.push(municipalityId);
  return ` AND ${tableAlias}.municipalidad_id = $${values.length}`;
}

function mapPublicReport(row) {
  if (!row) return null;
  const {
    foto_storage_key: _storageKey,
    foto_mime_type: _mimeType,
    foto_size_bytes: _sizeBytes,
    foto_sha256: _sha256,
    foto_ancho_px: _width,
    foto_alto_px: _height,
    geocodificacion_proveedor: _geocodingProvider,
    geocodificacion_resuelta_at: _geocodedAt,
    ...publicFields
  } = row;
  return {
    ...publicFields,
    latitud: Number(row.latitud),
    longitud: Number(row.longitud),
    precision_ubicacion_m: row.precision_ubicacion_m == null ? null : Number(row.precision_ubicacion_m),
    foto_url: `/api/v1/reportes/${row.id}/foto`,
  };
}

function auditSnapshot(row) {
  return {
    id: row.id,
    folio: row.folio,
    municipalidad_id: row.municipalidad_id,
    severidad: row.severidad,
    estado: row.estado,
    concurrencia_vial: row.concurrencia_vial,
    infraestructura_critica: row.infraestructura_critica,
    archivado_at: row.archivado_at ?? null,
  };
}

function validateCreateInput(input) {
  if (!input || typeof input !== 'object') throw new RepositoryValidationError('El reporte es obligatorio.');
  positiveInteger(input.municipalidad_id, 'municipalidad_id');
  for (const [field, min, max] of [['latitud', -90, 90], ['longitud', -180, 180]]) {
    const value = Number(input[field]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RepositoryValidationError(`${field} está fuera de rango.`, field);
    }
  }
  if (!LOCATION_METHODS.has(input.metodo_ubicacion)) {
    throw new RepositoryValidationError('metodo_ubicacion no es válido.', 'metodo_ubicacion');
  }
  if (input.ubicacion_confirmada !== true) {
    throw new RepositoryValidationError('La ubicación debe estar confirmada por el ciudadano.', 'ubicacion_confirmada');
  }
  if (!GEOCODING_STATES.has(input.estado_geocodificacion)) {
    throw new RepositoryValidationError('La ubicación debe estar resuelta o parcialmente resuelta.', 'estado_geocodificacion');
  }
  if (!String(input.comuna_detectada ?? '').trim()) {
    throw new RepositoryValidationError('La comuna debe estar resuelta antes de persistir un reporte.', 'comuna_detectada');
  }
  if (!String(input.region_detectada ?? '').trim()) {
    throw new RepositoryValidationError('La región debe estar resuelta antes de persistir un reporte.', 'region_detectada');
  }
  if (input.precision_ubicacion_m != null && (!Number.isFinite(Number(input.precision_ubicacion_m)) || Number(input.precision_ubicacion_m) < 0)) {
    throw new RepositoryValidationError('precision_ubicacion_m debe ser un número no negativo o null.', 'precision_ubicacion_m');
  }
  if (!SEVERITIES.has(input.severidad)) throw new RepositoryValidationError('severidad no es válida.', 'severidad');
  if (!TRAFFIC_LEVELS.has(input.concurrencia_vial)) throw new RepositoryValidationError('concurrencia_vial no es válida.', 'concurrencia_vial');
  if (!INFRASTRUCTURE_TYPES.has(input.infraestructura_critica)) {
    throw new RepositoryValidationError('infraestructura_critica no es válida.', 'infraestructura_critica');
  }
  if (input.descripcion != null && String(input.descripcion).length > 2000) {
    throw new RepositoryValidationError('descripcion no puede superar los 2.000 caracteres.', 'descripcion');
  }
  if (!String(input.foto_storage_key ?? '').trim() || String(input.foto_storage_key).includes('..') || String(input.foto_storage_key).startsWith('/')) {
    throw new RepositoryValidationError('foto_storage_key debe ser una clave relativa generada por el servidor.', 'foto_storage_key');
  }
  if (!PHOTO_TYPES.has(input.foto_mime_type)) throw new RepositoryValidationError('La fotografía debe ser JPEG, PNG o WebP.', 'foto_mime_type');
  const photoSize = Number(input.foto_size_bytes);
  if (!Number.isInteger(photoSize) || photoSize < 1 || photoSize > MAX_PHOTO_BYTES) {
    throw new RepositoryValidationError('La fotografía debe pesar entre 1 byte y 10 MB.', 'foto_size_bytes');
  }
  if (!/^[0-9a-f]{64}$/.test(String(input.foto_sha256 ?? ''))) {
    throw new RepositoryValidationError('foto_sha256 debe ser un SHA-256 hexadecimal en minúsculas.', 'foto_sha256');
  }
  if (input.clasificacion_vial != null && !ROAD_CLASSES.has(input.clasificacion_vial)) {
    throw new RepositoryValidationError('clasificacion_vial no es válida.', 'clasificacion_vial');
  }
  const roadStatus = input.clasificacion_vial_estado ?? (input.clasificacion_vial ? 'confirmada' : 'pendiente');
  if (!ROAD_CLASS_STATES.has(roadStatus)) throw new RepositoryValidationError('clasificacion_vial_estado no es válido.', 'clasificacion_vial_estado');
  if (input.clasificacion_vial && (!input.clasificacion_vial_fuente || !input.clasificacion_vial_verificada_at || roadStatus !== 'confirmada')) {
    throw new RepositoryValidationError('Una clasificación vial confirmada requiere fuente y fecha de verificación.', 'clasificacion_vial_fuente');
  }
  if (!input.clasificacion_vial && input.clasificacion_vial_fuente != null) {
    throw new RepositoryValidationError('No puede registrarse una fuente sin una clasificación vial confirmada.', 'clasificacion_vial_fuente');
  }
  if ((input.foto_ancho_px == null) !== (input.foto_alto_px == null)
      || (input.foto_ancho_px != null && (!Number.isInteger(Number(input.foto_ancho_px)) || Number(input.foto_ancho_px) < 1))
      || (input.foto_alto_px != null && (!Number.isInteger(Number(input.foto_alto_px)) || Number(input.foto_alto_px) < 1))) {
    throw new RepositoryValidationError('Las dimensiones de la fotografía deben ser ambos nulas o dos enteros positivos.', 'foto_ancho_px');
  }
  if (!input.clasificacion_vial && roadStatus === 'confirmada') {
    throw new RepositoryValidationError('No puede marcarse una clasificación como confirmada si la categoría es nula.', 'clasificacion_vial_estado');
  }
  return {
    ...input,
    municipalidad_id: Number(input.municipalidad_id),
    latitud: Number(input.latitud),
    longitud: Number(input.longitud),
    precision_ubicacion_m: input.precision_ubicacion_m == null ? null : Number(input.precision_ubicacion_m),
    foto_size_bytes: photoSize,
    clasificacion_vial_estado: roadStatus,
    estado_asignacion: 'asignado',
  };
}

function normalizeAuditActor(actor = { tipo_actor: 'invitado', actor_user_id: null }) {
  const normalized = {
    tipo_actor: actor.tipo_actor ?? 'invitado',
    actor_user_id: actor.actor_user_id ?? null,
    request_id: actor.request_id ?? null,
  };
  if (normalized.tipo_actor === 'funcionario' && !Number.isInteger(Number(normalized.actor_user_id))) {
    throw new RepositoryValidationError('La auditoría de funcionario requiere actor_user_id.', 'actor_user_id');
  }
  if (normalized.tipo_actor !== 'funcionario' && normalized.actor_user_id != null) {
    throw new RepositoryValidationError('actor_user_id solo se usa para funcionarios.', 'actor_user_id');
  }
  return normalized;
}

async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Mantener el error original. */ }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Crea un reporte. municipalidad_id y los metadatos geográficos deben proceder de LocationService,
 * nunca directamente del formulario ciudadano. El control de cobertura se repite dentro de la transacción.
 */
export async function createReport(pool, input, actor) {
  const data = validateCreateInput(input);
  const auditActor = normalizeAuditActor(actor ?? { tipo_actor: 'invitado', actor_user_id: null });

  return withTransaction(pool, async (client) => {
    const coverage = await client.query(
      `SELECT id FROM municipalidades
        WHERE id = $1 AND activa IS TRUE AND servicio_activo IS TRUE
        FOR SHARE`,
      [data.municipalidad_id],
    );
    if (coverage.rowCount === 0) throw new MunicipalityCoverageError();

    const insert = await client.query(
      `INSERT INTO reportes (
         municipalidad_id, latitud, longitud, precision_ubicacion_m, metodo_ubicacion, ubicacion_confirmada,
         direccion_detectada, calle_detectada, comuna_detectada, region_detectada,
         estado_geocodificacion, geocodificacion_proveedor, geocodificacion_resuelta_at, estado_asignacion,
         clasificacion_vial, clasificacion_vial_estado, clasificacion_vial_fuente, clasificacion_vial_verificada_at,
         severidad, estado, concurrencia_vial, infraestructura_critica, descripcion,
         foto_storage_key, foto_mime_type, foto_size_bytes, foto_sha256, foto_ancho_px, foto_alto_px
       ) VALUES (
         $1, $2, $3, $4, $5, TRUE,
         $6, $7, $8, $9,
         $10, $11, $12, 'asignado',
         $13, $14, $15, $16,
         $17, 'pendiente', $18, $19, $20,
         $21, $22, $23, $24, $25, $26
       ) RETURNING *`,
      [
        data.municipalidad_id, data.latitud, data.longitud, data.precision_ubicacion_m, data.metodo_ubicacion,
        data.direccion_detectada ?? null, data.calle_detectada ?? null, data.comuna_detectada ?? null, data.region_detectada ?? null,
        data.estado_geocodificacion, data.geocodificacion_proveedor ?? null, data.geocodificacion_resuelta_at ?? new Date(),
        data.clasificacion_vial ?? null, data.clasificacion_vial_estado,
        data.clasificacion_vial_fuente ?? null, data.clasificacion_vial_verificada_at ?? null,
        data.severidad, data.concurrencia_vial, data.infraestructura_critica, data.descripcion?.trim() || null,
        data.foto_storage_key, data.foto_mime_type, data.foto_size_bytes, data.foto_sha256,
        data.foto_ancho_px ?? null, data.foto_alto_px ?? null,
      ],
    );
    const row = insert.rows[0];
    await insertAuditEvent(client, {
      ...auditActor,
      entidad: 'reportes',
      entidad_id: row.id,
      accion: 'reporte.creado',
      cambios: { after: auditSnapshot(row) },
    });
    return mapPublicReport(row);
  });
}

/** Lista reportes paginados. Los usuarios municipales siempre quedan filtrados por su propio ámbito. */
export async function listReports(pool, {
  scope,
  estado,
  severidad,
  municipalidad_id,
  page = 1,
  limit = 20,
} = {}) {
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new RepositoryValidationError('page debe ser >= 1.', 'page');
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    throw new RepositoryValidationError('limit debe estar entre 1 y 100.', 'limit');
  }
  if (estado != null && !STATUSES.has(estado)) throw new RepositoryValidationError('estado no es válido.', 'estado');
  if (severidad != null && !SEVERITIES.has(severidad)) throw new RepositoryValidationError('severidad no es válida.', 'severidad');

  const isSuperAdmin = scope?.rol === 'superadministrador';
  if (municipalidad_id != null && !isSuperAdmin) {
    const requestedMunicipality = positiveInteger(municipalidad_id, 'municipalidad_id');
    if (requestedMunicipality !== positiveInteger(scope?.municipalidad_id, 'municipalidad_id')) {
      throw new RepositoryForbiddenError('No puede filtrar reportes de otra municipalidad.');
    }
  }

  const values = [];
  const conditions = ['r.archivado_at IS NULL'];
  const scopeClause = reportScopeClause(scope, values);
  if (scopeClause) conditions.push(scopeClause.replace(/^ AND /, ''));
  if (estado != null) { values.push(estado); conditions.push(`r.estado = $${values.length}`); }
  if (severidad != null) { values.push(severidad); conditions.push(`r.severidad = $${values.length}`); }
  if (municipalidad_id != null && isSuperAdmin) {
    values.push(positiveInteger(municipalidad_id, 'municipalidad_id'));
    conditions.push(`r.municipalidad_id = $${values.length}`);
  }
  const whereClause = conditions.join(' AND ');
  const countResult = await pool.query(
    `SELECT COUNT(*)::INTEGER AS total FROM reportes r WHERE ${whereClause}`,
    [...values],
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const offset = (pageNumber - 1) * limitNumber;
  const pageValues = [...values, limitNumber, offset];
  const result = await pool.query(
    `SELECT r.* FROM reportes r WHERE ${whereClause}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues,
  );
  return {
    data: result.rows.map(mapPublicReport),
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / limitNumber),
    },
  };
}

/** Devuelve null tanto si no existe como si pertenece a otra municipalidad. */
export async function getReportById(pool, id, scope) {
  const reportId = positiveInteger(id, 'id');
  const values = [reportId];
  const scopeClause = reportScopeClause(scope, values);
  const { rows } = await pool.query(
    `SELECT r.* FROM reportes r
      WHERE r.id = $1 AND r.archivado_at IS NULL${scopeClause}`,
    values,
  );
  return mapPublicReport(rows[0]);
}

/** Metadatos privados para StorageService; nunca devolver storage_key al cliente API. */
export async function getReportPhotoMetadata(pool, id, scope) {
  const reportId = positiveInteger(id, 'id');
  const values = [reportId];
  const scopeClause = reportScopeClause(scope, values);
  const { rows } = await pool.query(
    `SELECT r.id, r.foto_storage_key, r.foto_mime_type, r.foto_size_bytes, r.foto_sha256,
            r.foto_ancho_px, r.foto_alto_px
       FROM reportes r
      WHERE r.id = $1 AND r.archivado_at IS NULL${scopeClause}`,
    values,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    storage_key: row.foto_storage_key,
    mime_type: row.foto_mime_type,
    size_bytes: Number(row.foto_size_bytes),
    sha256: row.foto_sha256,
    width_px: row.foto_ancho_px,
    height_px: row.foto_alto_px,
  };
}

/**
 * Actualiza campos permitidos y registra before/after en la misma transacción.
 * Inspector solo puede cambiar estado; admin municipal/superadmin puede actualizar contexto y estado.
 */
export async function updateReport(pool, id, updates, scope, actor) {
  const reportId = positiveInteger(id, 'id');
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new RepositoryValidationError('El cuerpo de actualización debe ser un objeto.');
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) throw new RepositoryValidationError('Debe incluir al menos un campo para actualizar.');
  for (const key of keys) {
    if (!Object.hasOwn(UPDATE_COLUMN_BY_FIELD, key)) throw new RepositoryValidationError(`Campo no actualizable: ${key}.`, key);
  }
  if (scope?.rol === 'inspector' && keys.some((key) => key !== 'estado')) {
    throw new RepositoryForbiddenError('Un inspector solo puede cambiar el estado del reporte.');
  }
  if (!['inspector', 'administrador_municipal', 'superadministrador'].includes(scope?.rol)) {
    throw new RepositoryForbiddenError('El rol no puede actualizar reportes.');
  }
  validateUpdates(updates);
  const auditActor = normalizeAuditActor(actor);
  if (auditActor.tipo_actor !== 'funcionario') {
    throw new RepositoryForbiddenError('Las modificaciones administrativas deben registrar un funcionario autenticado.');
  }

  return withTransaction(pool, async (client) => {
    const valuesForSelect = [reportId];
    const scopeClause = reportScopeClause(scope, valuesForSelect);
    const currentResult = await client.query(
      `SELECT r.* FROM reportes r
        WHERE r.id = $1 AND r.archivado_at IS NULL${scopeClause}
        FOR UPDATE`,
      valuesForSelect,
    );
    const before = currentResult.rows[0];
    if (!before) return null;

    const changedKeys = keys.filter((key) => updates[key] !== before[key]);
    if (changedKeys.length === 0) return mapPublicReport(before);

    const values = [reportId];
    const setClause = changedKeys.map((key) => {
      values.push(key === 'descripcion' ? (updates[key]?.trim() || null) : updates[key]);
      return `${UPDATE_COLUMN_BY_FIELD[key]} = $${values.length}`;
    });
    const writeScope = reportScopeClause(scope, values);
    const updatedResult = await client.query(
      `UPDATE reportes r SET ${setClause.join(', ')}
        WHERE r.id = $1 AND r.archivado_at IS NULL${writeScope}
        RETURNING r.*`,
      values,
    );
    const after = updatedResult.rows[0];
    if (!after) return null;

    await insertAuditEvent(client, {
      ...auditActor,
      entidad: 'reportes',
      entidad_id: reportId,
      accion: 'reporte.actualizado',
      cambios: { before: auditSnapshot(before), after: auditSnapshot(after) },
    });
    return mapPublicReport(after);
  });
}

function validateUpdates(updates) {
  if (Object.hasOwn(updates, 'severidad') && !SEVERITIES.has(updates.severidad)) throw new RepositoryValidationError('severidad no es válida.', 'severidad');
  if (Object.hasOwn(updates, 'estado') && !STATUSES.has(updates.estado)) throw new RepositoryValidationError('estado no es válido.', 'estado');
  if (Object.hasOwn(updates, 'concurrencia_vial') && !TRAFFIC_LEVELS.has(updates.concurrencia_vial)) throw new RepositoryValidationError('concurrencia_vial no es válida.', 'concurrencia_vial');
  if (Object.hasOwn(updates, 'infraestructura_critica') && !INFRASTRUCTURE_TYPES.has(updates.infraestructura_critica)) {
    throw new RepositoryValidationError('infraestructura_critica no es válida.', 'infraestructura_critica');
  }
  if (updates.descripcion != null && String(updates.descripcion).length > 2000) {
    throw new RepositoryValidationError('descripcion no puede superar los 2.000 caracteres.', 'descripcion');
  }
}

/** Archivo lógico: nunca ejecuta DELETE físico sobre reportes. Solo administrador municipal/superadmin. */
export async function archiveReport(pool, id, scope, actor) {
  const reportId = positiveInteger(id, 'id');
  if (!['administrador_municipal', 'superadministrador'].includes(scope?.rol)) {
    throw new RepositoryForbiddenError('Solo administración municipal puede archivar reportes.');
  }
  const auditActor = normalizeAuditActor(actor);
  if (auditActor.tipo_actor !== 'funcionario') {
    throw new RepositoryForbiddenError('Las modificaciones administrativas deben registrar un funcionario autenticado.');
  }

  return withTransaction(pool, async (client) => {
    const valuesForSelect = [reportId];
    const scopeClause = reportScopeClause(scope, valuesForSelect);
    const currentResult = await client.query(
      `SELECT r.* FROM reportes r
        WHERE r.id = $1 AND r.archivado_at IS NULL${scopeClause}
        FOR UPDATE`,
      valuesForSelect,
    );
    const before = currentResult.rows[0];
    if (!before) return null;

    const values = [reportId];
    const writeScope = reportScopeClause(scope, values);
    const updateResult = await client.query(
      `UPDATE reportes r SET archivado_at = clock_timestamp()
        WHERE r.id = $1 AND r.archivado_at IS NULL${writeScope}
        RETURNING r.*`,
      values,
    );
    const after = updateResult.rows[0];
    if (!after) return null;

    await insertAuditEvent(client, {
      ...auditActor,
      entidad: 'reportes',
      entidad_id: reportId,
      accion: 'reporte.archivado',
      cambios: { before: auditSnapshot(before), after: auditSnapshot(after) },
    });
    return mapPublicReport(after);
  });
}

export const reportRepositoryConstants = Object.freeze({
  MAX_PHOTO_BYTES,
  SEVERITIES: [...SEVERITIES],
  STATUSES: [...STATUSES],
  TRAFFIC_LEVELS: [...TRAFFIC_LEVELS],
  INFRASTRUCTURE_TYPES: [...INFRASTRUCTURE_TYPES],
});
