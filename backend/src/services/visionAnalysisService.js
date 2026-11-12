'use strict';

const AppError = require('../middlewares/AppError');
const management = require('./reportManagementService');
const visionService = require('./visionService');
const reportService = require('./reportService');

const ESTADOS_EN_CURSO = ['pendiente', 'procesando'];
const VENCIMIENTO_EN_CURSO_MS = 5 * 60 * 1000;

let persistenciaPromise = null;
function cargarPersistenciaReal() {
  if (!persistenciaPromise) {
    persistenciaPromise = Promise.all([
      import('../config/database.js'),
      import('../repositories/visionAnalysisRepository.js'),
    ])
      .then(([database, vision]) => ({ pool: database.pool, vision }))
      .catch((error) => { persistenciaPromise = null; throw error; });
  }
  return persistenciaPromise;
}

function parseId(valor) {
  const n = Number(valor);
  if (!/^[1-9][0-9]*$/.test(String(valor)) || !Number.isSafeInteger(n)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ID inválido.');
  }
  return n;
}

function scopeDe(usuario) {
  if (!usuario?.rol) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'No autenticado.');
  return { rol: usuario.rol, municipalidad_id: usuario.municipalidad_id };
}

async function listarPorReporte(reporteId, usuario) {
  const { pool, vision } = await cargarPersistenciaReal();
  const filas = await vision.listVisionAnalysesByReport(pool, parseId(reporteId), scopeDe(usuario));
  if (filas === null) throw new AppError(404, 'NOT_FOUND', 'Reporte no encontrado.');
  return filas;
}

async function obtener(analisisId, usuario) {
  const { pool, vision } = await cargarPersistenciaReal();
  const fila = await vision.getVisionAnalysisById(pool, parseId(analisisId), scopeDe(usuario));
  if (!fila) throw new AppError(404, 'NOT_FOUND', 'Análisis no encontrado.');
  return fila;
}

async function solicitar(reporteId, usuario, requestId = null) {
  const id = parseId(reporteId);
  const scope = scopeDe(usuario);
  const actor = { tipo_actor: 'funcionario', actor_user_id: usuario.id, request_id: requestId };

  const reporte = await management.getReportById(id, usuario);
  const foto = await management.getReportPhotoMetadata(id, usuario);
  if (!foto?.storage_key) throw new AppError(409, 'FOTO_NO_DISPONIBLE', 'Sin fotografía.');
  if (!visionService.visionHabilitada()) throw new AppError(503, 'VISION_DESHABILITADA', 'Visión deshabilitada.');

  const { pool, vision } = await cargarPersistenciaReal();
  const existentes = (await vision.listVisionAnalysesByReport(pool, id, scope)) ?? [];
  const ahora = Date.now();
  
  if (existentes.find((a) => ESTADOS_EN_CURSO.includes(a.estado) && ahora - new Date(a.created_at).getTime() < VENCIMIENTO_EN_CURSO_MS)) {
    throw new AppError(409, 'ANALISIS_EN_CURSO', 'Ya existe un análisis en curso.');
  }

  const fila = await vision.createVisionAnalysis(
    pool,
    { reporte_id: id, estado: 'pendiente', detecciones: [] },
    { scope, actor }
  );

  reportService.iniciarAnalisisVision(reporte, foto.storage_key, requestId, { analisisId: fila.id });
  return fila;
}

module.exports = { listarPorReporte, obtener, solicitar };