import { RepositoryForbiddenError, RepositoryValidationError } from './repositoryErrors.js';

function normalizeLocationText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeRegion(value) {
  const normalized = normalizeLocationText(value);
  // Proveedores geográficos pueden escribir la Región Metropolitana de Santiago
  // con variaciones menores. Se mantiene una normalización acotada y explícita.
  if (['regionmetropolitanadesantiago', 'regionmetropolitana', 'metropolitana', 'rm'].includes(normalized)) {
    return 'regionmetropolitana';
  }
  return normalized;
}

function mapMunicipality(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    comuna: row.comuna,
    region: row.region,
    activa: row.activa,
    servicio_activo: row.servicio_activo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Lista las municipalidades que realmente reciben reportes. */
export async function listCoveredMunicipalities(pool) {
  const { rows } = await pool.query(
    `SELECT id, nombre, comuna, region, activa, servicio_activo, created_at, updated_at
       FROM municipalidades
      WHERE activa IS TRUE AND servicio_activo IS TRUE
      ORDER BY comuna ASC`,
  );
  return rows.map(mapMunicipality);
}

/**
 * Resuelve los nombres entregados por LocationService contra el catálogo local.
 * Devuelve covered / not_covered / unknown; no inventa una municipalidad.
 * Se consultan también filas con servicio desactivado para poder mostrar el mensaje de cobertura.
 */
export async function resolveMunicipalityCoverage(pool, { comuna, region }) {
  if (!String(comuna ?? '').trim() || !String(region ?? '').trim()) {
    throw new RepositoryValidationError('comuna y region son obligatorias para resolver cobertura.', 'comuna');
  }

  const { rows } = await pool.query(
    `SELECT id, nombre, comuna, region, comuna_key, geocodificacion_aliases,
            activa, servicio_activo, created_at, updated_at
       FROM municipalidades`,
  );

  const normalizedComuna = normalizeLocationText(comuna);
  const normalizedRegion = normalizeRegion(region);
  const matches = rows.filter((row) => {
    const candidates = [row.comuna, row.comuna_key, ...(row.geocodificacion_aliases ?? [])]
      .map(normalizeLocationText);
    return candidates.includes(normalizedComuna)
      && normalizeRegion(row.region) === normalizedRegion;
  });

  if (matches.length !== 1) {
    return { status: 'unknown', municipality: null };
  }

  const row = matches[0];
  const municipality = mapMunicipality(row);
  if (!row.activa || !row.servicio_activo) {
    return { status: 'not_covered', municipality };
  }
  return { status: 'covered', municipality };
}

/** Solo superadministración puede consultar municipalidades desactivadas. */
export async function getMunicipalityById(pool, id, { rol } = {}) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    throw new RepositoryValidationError('El id de municipalidad debe ser un entero positivo.', 'id');
  }
  if (rol !== 'superadministrador') {
    const { rows } = await pool.query(
      `SELECT id, nombre, comuna, region, activa, servicio_activo, created_at, updated_at
         FROM municipalidades WHERE id = $1 AND activa IS TRUE`,
      [numericId],
    );
    return mapMunicipality(rows[0]);
  }
  const { rows } = await pool.query(
    `SELECT id, nombre, comuna, region, activa, servicio_activo, created_at, updated_at
       FROM municipalidades WHERE id = $1`,
    [numericId],
  );
  return mapMunicipality(rows[0]);
}

/** Ayuda para validar el ámbito de acceso en funciones municipales. */
export function assertMunicipalScope(scope) {
  if (scope?.rol === 'superadministrador') return { global: true, municipalidad_id: null };
  if (['inspector', 'administrador_municipal'].includes(scope?.rol)
      && Number.isInteger(Number(scope?.municipalidad_id))
      && Number(scope.municipalidad_id) > 0) {
    return { global: false, municipalidad_id: Number(scope.municipalidad_id) };
  }
  throw new RepositoryForbiddenError('El usuario no tiene un ámbito municipal válido.');
}
