'use strict';

const AppError = require('../middlewares/AppError');
const management = require('./reportManagementService');
const visionService = require('./visionService');
const reportService = require('./reportService');

/**
 * Casos de uso de los endpoints del contrato 7.5:
 *   GET  /api/v1/reportes/:id/analisis-vision   → listarPorReporte
 *   POST /api/v1/reportes/:id/analisis-vision   → solicitar   (202, asíncrono)
 *   GET  /api/v1/analisis-vision/:id            → obtener
 *
 * Capa de negocio: valida entradas, aplica el ámbito municipal (lo vuelve a verificar la
 * consulta SQL) y traduce los errores de repositorio a AppError. No usa Express.
 */

const ESTADOS_EN_CURSO = ['pendiente', 'procesando'];
// Una fila "en curso" más antigua que esto se considera abandonada (servidor caído a mitad de análisis).
const VENCIMIENTO_EN_CURSO_MS = 5 * 60 * 1000;

// ───────────────────────────── Persistencia (repositorios ESM) ─────────────────────────────
let persistenciaPromise = null;
function cargarPersistenciaReal() {
  if (!persistenciaPromise) {
    persistenciaPromise = Promise.all([
      import('../config/database.js'),
      import('../repositories/visionAnalysisRepository.js'),
      import('../repositories/repositoryErrors.js'),
    ])
      .then(([database, vision, errores]) => ({ pool: database.pool, vision, errores }))
      .catch((error) => {
        persistenciaPromise = null;
        throw error;
      });
  }
  return persistenciaPromise;
}
let cargarPersistencia = cargarPersistenciaReal;

function traducirError(error, errores) {
  if (error instanceof AppError) return error;
  const e = errores ?? {};
  if (e.RepositoryValidationError && error instanceof e.RepositoryValidationError) {
    return new AppError(400, 'VALIDATION_ERROR', error.message, error.field ? [{ field: error.field, issue: error.message }] : []);
  }
  if (e.RepositoryForbiddenError && error instanceof e.RepositoryForbiddenError) {
    return new AppError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  }
  if (e.RepositoryNotFoundError && error instanceof e.RepositoryNotFoundError) {
    return new AppError(404, 'NOT_FOUND', 'El recurso no existe o no está disponible.');
  }
  if (e.RepositoryConflictError && error instanceof e.RepositoryConflictError) {
    return new AppError(409, 'CONFLICT', error.message);
  }
  return error; // lo demás sigue como 500 genérico (errorHandler no filtra detalles internos)
}

async function ejecutar(callback) {
  let persistencia;
  try {
    persistencia = await cargarPersistencia();
    return await callback(persistencia);
  } catch (error) {
    throw traducirError(error, persistencia?.errores);
  }
}

// ───────────────────────────── Utilidades ─────────────────────────────
function parseId(valor, campo = 'id') {
  const texto = String(valor ?? '');
  const n = Number(texto);
  if (!/^[1-9][0-9]*$/.test(texto) || !Number.isSafeInteger(n)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Hay parámetros que requieren corrección.', [
      { field: campo, issue: 'Debe ser un entero positivo.' },
    ]);
  }
  return n;
}

function scopeDe(usuario) {
  if (!usuario?.rol) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Se requiere autenticación válida.');
  return { rol: usuario.rol, municipalidad_id: usuario.municipalidad_id };
}

function actorFuncionario(usuario, requestId) {
  const id = Number(usuario?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Se requiere un funcionario autenticado.');
  }
  return { tipo_actor: 'funcionario', actor_user_id: id, request_id: requestId ?? null };
}

// ───────────────────────────── Casos de uso ─────────────────────────────
async function listarPorReporte(reporteId, usuario) {
  const id = parseId(reporteId);
  const scope = scopeDe(usuario);
  const filas = await ejecutar(({ pool, vision }) => vision.listVisionAnalysesByReport(pool, id, scope));
  if (filas === null) throw new AppError(404, 'NOT_FOUND', 'Reporte no encontrado.');
  return filas;
}

async function obtener(analisisId, usuario) {
  const id = parseId(analisisId);
  const scope = scopeDe(usuario);
  const fila = await ejecutar(({ pool, vision }) => vision.getVisionAnalysisById(pool, id, scope));
  if (!fila) throw new AppError(404, 'NOT_FOUND', 'Análisis no encontrado.');
  return fila;
}

/**
 * Crea una ejecución `pendiente` y la procesa en segundo plano (fire-and-forget).
 * Responde con la fila creada; el cliente consulta GET /analisis-vision/:id hasta ver
 * `completado` o `fallido`. Nunca bloquea la petición con la inferencia.
 */
async function solicitar(reporteId, usuario, requestId = null) {
  const id = parseId(reporteId);
  const scope = scopeDe(usuario);
  const actor = actorFuncionario(usuario, requestId);

  // Ambas consultas aplican el ámbito municipal: un reporte ajeno responde 404.
  const reporte = await management.getReportById(id, usuario);
  const foto = await management.getReportPhotoMetadata(id, usuario);
  if (!foto?.storage_key) {
    throw new AppError(409, 'FOTO_NO_DISPONIBLE', 'El reporte no tiene una fotografía para analizar.');
  }
  if (!visionService.visionHabilitada()) {
    throw new AppError(503, 'VISION_DESHABILITADA', 'El análisis de imagen está deshabilitado en este servidor.');
  }

  const fila = await ejecutar(async ({ pool, vision }) => {
    const existentes = (await vision.listVisionAnalysesByReport(pool, id, scope)) ?? [];
    const ahora = Date.now();
    const enCurso = existentes.find(
      (a) => ESTADOS_EN_CURSO.includes(a.estado) && ahora - new Date(a.created_at).getTime() < VENCIMIENTO_EN_CURSO_MS
    );
    if (enCurso) {
      throw new AppError(409, 'ANALISIS_EN_CURSO', 'Ya existe un análisis en curso para este reporte.');
    }
    return vision.createVisionAnalysis(
      pool,
      { reporte_id: id, estado: 'pendiente', detecciones: [] },
      { scope, actor }
    );
  });

  // La fila ya existe: el trabajo se reutiliza esa misma fila (no crea otra) y NO se espera.
  reportService.iniciarAnalisisVision(reporte, foto.storage_key, requestId, { analisisId: fila.id });
  return fila;
}

module.exports = {
  listarPorReporte,
  obtener,
  solicitar,
  parseId,
  _setPersistenciaParaPruebas(fn) { cargarPersistencia = fn ?? cargarPersistenciaReal; },
};
