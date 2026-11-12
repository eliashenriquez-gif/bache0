'use strict';

// node --test test/uploadValidation.test.js — sin multer, sharp ni file-type (multer se simula).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AppError = require('../src/middlewares/AppError');
const up = require('../src/middlewares/uploadValidation');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('VP8 ')]);
const GIF = Buffer.from('GIF89a\x01\x00\x01\x00', 'binary');
const PDF = Buffer.from('%PDF-1.7\n1 0 obj');
const EXE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00', 'binary');
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic')]);

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'bache0-upload-'));
test.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));
const archivo = (nombre, bytes) => { const ruta = path.join(carpeta, nombre); fs.writeFileSync(ruta, bytes); return ruta; };
const correr = (mw, req, res = { set() {} }) => new Promise((resolve) => mw(req, res, (error) => resolve(error)));

test('constantes: 10 MiB por foto y JPEG/PNG/WebP', () => {
  assert.equal(up.MAX_PHOTO_BYTES, 10 * 1024 * 1024);
  assert.deepEqual(up.ALLOWED_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
  assert.ok(up.MAX_REQUEST_BYTES > up.MAX_PHOTO_BYTES);
});

test('sniffImageType reconoce solo JPEG, PNG y WebP por su firma', () => {
  assert.equal(up.sniffImageType(JPEG), 'image/jpeg');
  assert.equal(up.sniffImageType(PNG), 'image/png');
  assert.equal(up.sniffImageType(WEBP), 'image/webp');
  for (const malo of [GIF, PDF, EXE, HEIC, Buffer.alloc(0), Buffer.from([0xff, 0xd8]), Buffer.from('RIFF....WAVE')]) {
    assert.equal(up.sniffImageType(malo), null);
  }
  assert.equal(up.sniffImageType(null), null);
});

// ───────── 1. Content-Length ─────────
test('Content-Length mayor al máximo: 413 FILE_TOO_LARGE sin leer el cuerpo', async () => {
  const headers = {};
  const error = await correr(up.rejectOversizedRequest, { headers: { 'content-length': String(up.MAX_REQUEST_BYTES + 1) } }, { set: (k, v) => { headers[k] = v; } });
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 413);
  assert.equal(error.code, 'FILE_TOO_LARGE');
  assert.equal(error.details[0].field, 'foto');
  assert.equal(headers.Connection, 'close');
});

test('Content-Length normal, ausente o inválido: sigue (decide Multer)', async () => {
  assert.equal(await correr(up.rejectOversizedRequest, { headers: { 'content-length': '2048' } }), undefined);
  assert.equal(await correr(up.rejectOversizedRequest, { headers: {} }), undefined);
  assert.equal(await correr(up.rejectOversizedRequest, { headers: { 'content-length': 'abc' } }), undefined);
});

// ───────── 2. Filtro por tipo declarado ─────────
test('fileFilter: acepta image/jpeg|png|webp y octet-stream/vacío (decide la firma real)', () => {
  for (const mimetype of ['image/jpeg', 'image/png', 'image/webp', 'IMAGE/JPEG', 'application/octet-stream', '']) {
    let resultado;
    up.fileFilter({}, { mimetype }, (error, ok) => { resultado = { error, ok }; });
    assert.equal(resultado.error, null, mimetype);
    assert.equal(resultado.ok, true);
  }
});

test('fileFilter: rechaza PDF, GIF, HEIC, SVG, texto y ejecutables con 415 claro', () => {
  for (const mimetype of ['application/pdf', 'image/gif', 'image/heic', 'image/svg+xml', 'text/plain', 'application/x-msdownload', 'video/mp4']) {
    let error;
    up.fileFilter({}, { mimetype }, (e) => { error = e; });
    assert.ok(error instanceof AppError, mimetype);
    assert.equal(error.statusCode, 415);
    assert.equal(error.code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.match(error.message, /JPEG, PNG o WebP/);
    assert.equal(error.details[0].field, 'foto');
  }
});

// ───────── Traducción de errores de Multer ─────────
const multerError = (code, field) => Object.assign(new Error(code), { name: 'MulterError', code, field });

test('LIMIT_FILE_SIZE → 413 FILE_TOO_LARGE (10 MB)', () => {
  const e = up.translateUploadError(multerError('LIMIT_FILE_SIZE', 'foto'));
  assert.equal(e.statusCode, 413);
  assert.equal(e.code, 'FILE_TOO_LARGE');
  assert.match(e.message, /10 MB/);
});

test('campo con otro nombre o varios archivos → 400 con el campo esperado', () => {
  for (const code of ['LIMIT_UNEXPECTED_FILE', 'LIMIT_FILE_COUNT']) {
    const e = up.translateUploadError(multerError(code, 'imagen'));
    assert.equal(e.statusCode, 400);
    assert.equal(e.code, 'VALIDATION_ERROR');
    assert.match(e.message, /campo "foto"/);
  }
});

test('límites de campos/partes y otros MulterError → 400', () => {
  for (const code of ['LIMIT_FIELD_KEY', 'LIMIT_FIELD_VALUE', 'LIMIT_FIELD_COUNT', 'LIMIT_PART_COUNT', 'OTRO']) {
    assert.equal(up.translateUploadError(multerError(code)).statusCode, 400, code);
  }
});

test('multipart mal formado (error simple de busboy) → 400, no 500', () => {
  for (const mensaje of ['Unexpected end of form', 'Malformed part header', 'Multipart: Boundary not found']) {
    assert.equal(up.translateUploadError(new Error(mensaje)).statusCode, 400, mensaje);
  }
});

test('errores de sistema (ENOSPC), AppError y "sin error" pasan sin tocarse', () => {
  const enospc = Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
  assert.equal(up.translateUploadError(enospc), enospc);
  const app = new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'x');
  assert.equal(up.translateUploadError(app), app);
  assert.equal(up.translateUploadError(null), null);
  assert.equal(up.translateUploadError(undefined), undefined);
  const raro = new Error('boom');
  assert.equal(up.translateUploadError(raro), raro);
});

// ───────── 3. Firma real del archivo ─────────
test('verifyUploadedImage: JPEG, PNG y WebP reales pasan y el archivo se conserva', async () => {
  for (const [nombre, bytes] of [['a.jpg', JPEG], ['b.png', PNG], ['c.webp', WEBP]]) {
    const ruta = archivo(nombre, bytes);
    assert.equal(await correr(up.verifyUploadedImage, { file: { path: ruta } }), undefined, nombre);
    assert.ok(fs.existsSync(ruta));
  }
});

test('verifyUploadedImage: un .exe/PDF/GIF/HEIC renombrado como foto.jpg se rechaza con 415 y se borra el temporal', async () => {
  for (const [nombre, bytes] of [['x.exe', EXE], ['y.pdf', PDF], ['z.gif', GIF], ['h.heic', HEIC], ['t.txt', Buffer.from('hola, esto es texto')]]) {
    const ruta = archivo(nombre, bytes);
    const error = await correr(up.verifyUploadedImage, { file: { path: ruta, mimetype: 'image/jpeg', originalname: 'foto.jpg' } });
    assert.ok(error instanceof AppError, nombre);
    assert.equal(error.statusCode, 415);
    assert.equal(error.code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.equal(fs.existsSync(ruta), false, `el temporal de ${nombre} debe borrarse`);
  }
});

test('verifyUploadedImage: archivo vacío → 415 "La imagen está vacía" y se borra', async () => {
  const ruta = archivo('vacio.jpg', Buffer.alloc(0));
  const error = await correr(up.verifyUploadedImage, { file: { path: ruta } });
  assert.equal(error.statusCode, 415);
  assert.match(error.message, /vacía/);
  assert.equal(fs.existsSync(ruta), false);
});

test('verifyUploadedImage: sin archivo sigue (reportService responde 400 "La fotografía es obligatoria")', async () => {
  assert.equal(await correr(up.verifyUploadedImage, {}), undefined);
});

test('verifyUploadedImage: si no puede leer el archivo, propaga el error (no lo traga)', async () => {
  const error = await correr(up.verifyUploadedImage, { file: { path: path.join(carpeta, 'no-existe.jpg') } });
  assert.ok(error instanceof Error);
  assert.equal(error.code, 'ENOENT');
});

// ───────── createPhotoUpload (multer simulado) ─────────
function multerFalso(comportamiento) {
  const registro = { opciones: null, campo: null };
  const multer = (opciones) => { registro.opciones = opciones; return { single: (campo) => { registro.campo = campo; return comportamiento; } }; };
  multer.diskStorage = (config) => ({ config });
  return { multer, registro };
}

test('createPhotoUpload configura Multer: 10 MB, 1 archivo, campos acotados, campo "foto" y nombre aleatorio', () => {
  const { multer, registro } = multerFalso((req, res, cb) => cb());
  const mws = up.createPhotoUpload(multer);
  assert.equal(mws.length, 3);
  assert.equal(registro.campo, 'foto');
  assert.equal(registro.opciones.limits.fileSize, 10 * 1024 * 1024);
  assert.equal(registro.opciones.limits.files, 1);
  assert.ok(registro.opciones.limits.fields <= 20 && registro.opciones.limits.fieldSize <= 16 * 1024);
  assert.equal(registro.opciones.fileFilter, up.fileFilter);
  let nombre;
  registro.opciones.storage.config.filename({}, { originalname: '../../etc/passwd.jpg' }, (e, n) => { nombre = n; });
  assert.match(nombre, /^[0-9a-f-]{36}$/, 'nunca se usa el nombre que envía el cliente');
});

test('createPhotoUpload: el error de Multer llega traducido al errorHandler', async () => {
  const { multer } = multerFalso((req, res, cb) => cb(multerError('LIMIT_FILE_SIZE', 'foto')));
  const [, parse] = up.createPhotoUpload(multer);
  const error = await correr(parse, {});
  assert.equal(error.statusCode, 413);
  assert.equal(error.code, 'FILE_TOO_LARGE');
});

test('createPhotoUpload: sin error de Multer, la solicitud continúa', async () => {
  const { multer } = multerFalso((req, res, cb) => cb());
  const [, parse] = up.createPhotoUpload(multer);
  assert.equal(await correr(parse, {}), undefined);
});
