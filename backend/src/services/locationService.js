
const AppError = require('../middlewares/AppError');

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const geoCache = new Map();

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function clean(value) {
  return String(value || '')
    .replace(/^(comuna|municipalidad) de\s+/i, '')
    .trim();
}

async function resolveCoverage(address, region) {
  const { pool } = await import('../config/database.js');
  const repo = await import('../repositories/municipalityRepository.js');

  const candidates = [...new Set([
    address.city_district,
    address.municipality,
    address.town,
    address.village,
    address.suburb,
    address.county,
  ].filter(Boolean).map(clean))];

  let inactive = null;

  for (const comuna of candidates) {
    const result = await repo.resolveMunicipalityCoverage(pool, {
      comuna,
      region,
    });

    if (result.status === 'covered') return result;
    if (result.status === 'not_covered') inactive = result;
  }

  return inactive || {
    status: 'unknown',
    municipality: null,
  };
}

async function consultarNominatim(latitud, longitud) {
  const key = `${latitud},${longitud}`;
  const ahora = Date.now();
  const cached = geoCache.get(key);

  if (cached && ahora < cached.expiresAt) {
    return cached.data;
  }

  geoCache.delete(key);

  let data;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitud}&lon=${longitud}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Bache0-GovTech-App/1.0',
          'Accept-Language': 'es',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error('Proveedor no disponible');
    }

    data = await response.json();
  } catch {
    throw new AppError(
      503,
      'UBICACION_TEMPORALMENTE_NO_DISPONIBLE',
      'No se pudo consultar el servicio geográfico.'
    );
  }

  // Guardamos únicamente respuestas geográficas válidas.
  if (data?.address) {
    if (geoCache.size >= CACHE_MAX_ENTRIES) {
      const primeraClave = geoCache.keys().next().value;
      geoCache.delete(primeraClave);
    }

    geoCache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return data;
}

async function resolverUbicacion(
  latitud,
  longitud,
  metodo_ubicacion = 'pin_manual',
  precision_ubicacion_m = null
) {
  if (
    !Number.isFinite(latitud) ||
    latitud < -90 ||
    latitud > 90 ||
    !Number.isFinite(longitud) ||
    longitud < -180 ||
    longitud > 180 ||
    !['gps', 'pin_manual'].includes(metodo_ubicacion) ||
    (
      precision_ubicacion_m !== null &&
      (
        !Number.isFinite(precision_ubicacion_m) ||
        precision_ubicacion_m < 0
      )
    )
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Los datos de ubicación son inválidos.'
    );
  }

  const data = await consultarNominatim(latitud, longitud);

  const address = data?.address;

  if (!address) {
    throw new AppError(
      422,
      'UBICACION_NO_RESUELTA',
      'No se pudo resolver la ubicación.'
    );
  }

  const region = address.state || address.region;

  if (!region) {
    throw new AppError(
      422,
      'UBICACION_NO_RESUELTA',
      'No se pudo identificar la región.'
    );
  }

  // La cobertura municipal siempre se comprueba en PostgreSQL.
  const coverage = await resolveCoverage(address, region);

  if (coverage.status === 'not_covered') {
    throw new AppError(
      422,
      'MUNICIPALIDAD_SIN_COBERTURA',
      'La municipalidad no tiene el servicio habilitado.'
    );
  }

  if (coverage.status !== 'covered') {
    throw new AppError(
      422,
      'UBICACION_NO_RESUELTA',
      'No se pudo identificar una comuna con cobertura de forma fiable.'
    );
  }

  const calle =
    address.road ||
    address.pedestrian ||
    address.residential ||
    address.footway ||
    null;

  const municipality = coverage.municipality;

  return {
    estado_resolucion: calle ? 'resuelta' : 'parcial',
    latitud,
    longitud,
    metodo_ubicacion,
    precision_ubicacion_m,
    direccion_detectada: calle ? (data.display_name || null) : null,
    calle_detectada: calle,
    comuna_detectada: municipality.comuna,
    region_detectada: municipality.region,
    municipalidad: {
      id: municipality.id,
      nombre: municipality.nombre,
    },
    clasificacion_vial: null,
    clasificacion_vial_estado: 'pendiente',
    clasificacion_vial_fuente: null,
    clasificacion_vial_verificada_at: null,
  };
}

module.exports = { resolverUbicacion };
