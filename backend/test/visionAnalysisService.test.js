'use strict';

// node --test test/visionAnalysisService.test.js
// Casos de uso del contrato 7.5 con persistencia, gestión de reportes y reportService simulados.

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const estado = {};
function reiniciar() {
  Object.assign(estado, { habilitada: true, reporte: { id: 7, municipalidad_id: 1, severidad: 'alta' }, foto: { storage_key: 'k.jpg' }, filas: [], creaciones: [], iniciados: [], consultas: [] });
}

const dobles = {
  './reportManagementService': {
    getReportById: async (id, usuario) => { estado.consultas.push(['reporte', id, usuario.rol]); if (!estado.reporte) throw new (require('../src/middlewares/AppError'))(404, 'NOT_FOUND', 'Reporte no encontrado.'); return estado.reporte; },
    getReportPhotoMetadata: async () => estado.foto,
  },
  './visionService': { visionHabilitada: () => estado.habilitada },
  './reportService': { iniciarAnalisisVision: (...args) => estado.iniciados.push(args) },
};
const cargaOriginal = Module._load;
Module._load = function (request, parent, ...resto) {
  if (Object.prototype.hasOwnProperty.call(dobles, request)) return dobles[request];
  return cargaOriginal.call(this, request, parent, ...resto);
};
const servicio = require('../src/services/visionAnalysisService');
const AppError = require('../src/middlewares/AppError');
Module._load = cargaOriginal;

class ErrorValidacion extends Error { constructor(m, field) { super(m); this.field = field; } }
class ErrorNoEncontrado extends Error {}
const persistencia = async () => ({
  pool: {},
  errores: { RepositoryValidationError: ErrorValidacion, RepositoryNotFoundError: ErrorNoEncontrado, RepositoryForbiddenError: class extends Error {}, RepositoryConflictError: class extends Error {} },
  vision: {
    listVisionAnalysesByReport: async (_p, id, scope) => { estado.consultas.push(['lista', id, scope]); return estado.filas.filter((f) => f.reporte_id === id); },
    getVisionAnalysisById: async (_p, id, scope) => { estado.consultas.push(['uno', id, scope]); return estado.filas.find((f) => f.id === id) ?? null; },
    createVisionAnalysis: async (_p, entrada, contexto) => { const fila = { id: 50 + estado.creaciones.length, created_at: new Date().toISOString(), ...entrada }; estado.creaciones.push({ entrada, contexto }); estado.filas.push(fila); return fila; },
  },
});

const inspector = { id: 3, rol: 'inspector', municipalidad_id: 1 };
const admin = { id: 4, rol: 'administrador_municipal', municipalidad_id: 1 };

test.beforeEach(() => { reiniciar(); servicio._setPersistenciaParaPruebas(persistencia); });

const rechaza = (promesa, codigo, status) => assert.rejects(promesa, (e) => e instanceof AppError && e.code === codigo && e.statusCode === status);

test('GET lista: devuelve los análisis del reporte con el ámbito del usuario', async () => {
  estado.filas.push({ id: 1, reporte_id: 7, estado: 'completado' }, { id: 2, reporte_id: 8, estado: 'completado' });
  const r = await servicio.listarPorReporte('7', inspector);
  assert.deepEqual(r.map((f) => f.id), [1]);
  assert.deepEqual(estado.consultas.at(-1), ['lista', 7, { rol: 'inspector', municipalidad_id: 1 }]);
});

test('GET lista: lista vacía es válida (200), pero un reporte no visible es 404', async () => {
  assert.deepEqual(await servicio.listarPorReporte('7', inspector), []);
  servicio._setPersistenciaParaPruebas(async () => ({ ...(await persistencia()), vision: { listVisionAnalysesByReport: async () => null } }));
  await rechaza(servicio.listarPorReporte('7', inspector), 'NOT_FOUND', 404);
});

test('GET por id: 404 si no existe o es de otra municipalidad', async () => {
  estado.filas.push({ id: 1, reporte_id: 7 });
  assert.equal((await servicio.obtener('1', inspector)).id, 1);
  await rechaza(servicio.obtener('99', inspector), 'NOT_FOUND', 404);
});

test('ids inválidos responden 400 con el campo', async () => {
  for (const malo of ['abc', '0', '-1', '1.5', '', '7; DROP TABLE', '1e3', '99999999999999999999']) {
    await assert.rejects(servicio.listarPorReporte(malo, inspector), (e) => e.statusCode === 400 && e.code === 'VALIDATION_ERROR' && e.details[0].field === 'id', `id "${malo}"`);
  }
  await rechaza(servicio.obtener('x', inspector), 'VALIDATION_ERROR', 400);
});

test('errores de validación del repositorio se traducen a 400', async () => {
  servicio._setPersistenciaParaPruebas(async () => ({ ...(await persistencia()), vision: { getVisionAnalysisById: async () => { throw new ErrorValidacion('id inválido', 'id'); } } }));
  await rechaza(servicio.obtener('1', inspector), 'VALIDATION_ERROR', 400);
});

test('sin usuario autenticado: 401', async () => {
  await rechaza(servicio.listarPorReporte('7', undefined), 'AUTHENTICATION_REQUIRED', 401);
});

test('POST: crea la fila pendiente como funcionario y lanza el análisis SIN esperarlo, reutilizando esa fila', async () => {
  const fila = await servicio.solicitar('7', admin, 'req-9');
  assert.equal(fila.estado, 'pendiente');
  assert.equal(estado.creaciones.length, 1);
  assert.deepEqual(estado.creaciones[0].contexto.actor, { tipo_actor: 'funcionario', actor_user_id: 4, request_id: 'req-9' });
  assert.deepEqual(estado.creaciones[0].contexto.scope, { rol: 'administrador_municipal', municipalidad_id: 1 });
  const [reporte, key, requestId, opciones] = estado.iniciados[0];
  assert.equal(reporte.id, 7);
  assert.equal(key, 'k.jpg');
  assert.equal(requestId, 'req-9');
  assert.deepEqual(opciones, { analisisId: fila.id });
});

test('POST: reporte inexistente o de otra municipalidad → 404 y no se crea nada', async () => {
  estado.reporte = null;
  await rechaza(servicio.solicitar('7', admin), 'NOT_FOUND', 404);
  assert.equal(estado.creaciones.length, 0);
});

test('POST: sin fotografía → 409', async () => {
  estado.foto = { storage_key: null };
  await rechaza(servicio.solicitar('7', admin), 'FOTO_NO_DISPONIBLE', 409);
});

test('POST: visión deshabilitada → 503 y no se crea fila', async () => {
  estado.habilitada = false;
  await rechaza(servicio.solicitar('7', admin), 'VISION_DESHABILITADA', 503);
  assert.equal(estado.creaciones.length, 0);
});

test('POST: ya hay un análisis en curso reciente → 409 (evita duplicar trabajo)', async () => {
  estado.filas.push({ id: 1, reporte_id: 7, estado: 'pendiente', created_at: new Date().toISOString() });
  await rechaza(servicio.solicitar('7', admin), 'ANALISIS_EN_CURSO', 409);
  assert.equal(estado.iniciados.length, 0);
});

test('POST: una fila "pendiente" abandonada (> 5 min) no bloquea un nuevo análisis', async () => {
  estado.filas.push({ id: 1, reporte_id: 7, estado: 'pendiente', created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() });
  const fila = await servicio.solicitar('7', admin);
  assert.equal(fila.estado, 'pendiente');
  assert.equal(estado.iniciados.length, 1);
});

test('POST: un análisis completado o fallido anterior permite uno nuevo (queda historial)', async () => {
  estado.filas.push({ id: 1, reporte_id: 7, estado: 'completado', created_at: new Date().toISOString() }, { id: 2, reporte_id: 7, estado: 'fallido', created_at: new Date().toISOString() });
  await servicio.solicitar('7', admin);
  assert.equal(estado.creaciones.length, 1);
});
