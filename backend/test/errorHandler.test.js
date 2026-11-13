'use strict';

// node --test test/errorHandler.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const original = Module._load;
Module._load = function (request, ...resto) {
  if (request === 'uuid') return { v4: () => 'uuid-generado' };
  return original.call(this, request, ...resto);
};
const { errorHandler, notFoundHandler } = require('../src/middlewares/errorHandler');
Module._load = original;
const AppError = require('../src/middlewares/AppError');

function respuesta() {
  const r = { cabeceras: {}, headersSent: false };
  r.set = (k, v) => { r.cabeceras[k] = v; return r; };
  r.status = (s) => { r.statusCode = s; return r; };
  r.json = (c) => { r.cuerpo = c; return r; };
  return r;
}
const manejar = (err, req = {}) => {
  const res = respuesta();
  const log = { warn: console.warn, error: console.error };
  console.warn = () => {}; console.error = () => {};
  try { errorHandler(err, { method: 'POST', originalUrl: '/api/v1/reportes', ...req }, res, () => {}); } finally { console.warn = log.warn; console.error = log.error; }
  return res;
};

test('el request_id del error es el mismo que usa la auditoría (req.requestId)', () => {
  const res = manejar(new AppError(404, 'NOT_FOUND', 'x'), { requestId: 'req-123' });
  assert.equal(res.cuerpo.error.request_id, 'req-123');
});

test('sin req.requestId genera uno (rutas fuera de la cadena normal)', () => {
  assert.equal(manejar(new AppError(404, 'NOT_FOUND', 'x')).cuerpo.error.request_id, 'uuid-generado');
});

test('estructura de error del contrato: { error: { code, message, details[], request_id } }', () => {
  const res = manejar(new AppError(400, 'VALIDATION_ERROR', 'Hay campos', [{ field: 'foto', issue: 'x' }]), { requestId: 'r' });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(Object.keys(res.cuerpo), ['error']);
  assert.deepEqual(Object.keys(res.cuerpo.error).sort(), ['code', 'details', 'message', 'request_id']);
  assert.deepEqual(res.cuerpo.error.details, [{ field: 'foto', issue: 'x' }]);
});

test('un error inesperado responde 500 genérico sin filtrar detalles internos', () => {
  const res = manejar(new Error('password authentication failed for user "bache0_app"'));
  assert.equal(res.statusCode, 500);
  assert.equal(res.cuerpo.error.code, 'INTERNAL_SERVER_ERROR');
  assert.ok(!JSON.stringify(res.cuerpo).includes('bache0_app'));
});

test('JSON demasiado grande (body-parser) → 413; JSON mal formado → 400', () => {
  const grande = Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 });
  assert.equal(manejar(grande).statusCode, 413);
  const malo = Object.assign(new SyntaxError('Unexpected token'), { status: 400, body: '{' });
  const res = manejar(malo);
  assert.equal(res.statusCode, 400);
  assert.match(res.cuerpo.error.message, /JSON/);
});

test('MulterError sin traducir (red de seguridad): tamaño → 413, otros → 400', () => {
  assert.equal(manejar(Object.assign(new Error('x'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' })).statusCode, 413);
  assert.equal(manejar(Object.assign(new Error('x'), { name: 'MulterError', code: 'LIMIT_UNEXPECTED_FILE' })).statusCode, 400);
});

test('429 incluye Retry-After', () => {
  const e = new AppError(429, 'RATE_LIMIT_EXCEEDED', 'x'); e.retryAfter = 42;
  assert.equal(manejar(e).cabeceras['Retry-After'], '42');
});

test('ruta inexistente: 404 NOT_FOUND con el mismo formato (no HTML)', () => {
  let capturado;
  notFoundHandler({}, {}, (e) => { capturado = e; });
  const res = manejar(capturado, { requestId: 'r' });
  assert.equal(res.statusCode, 404);
  assert.equal(res.cuerpo.error.code, 'NOT_FOUND');
});
