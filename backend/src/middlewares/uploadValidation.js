'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const AppError = require('./AppError');

/**
 * Subida de la fotografía del reporte ciudadano (POST /api/v1/reportes).
 *
 * Capas de defensa, de la más barata a la más cara (cada una responde con un error claro):
 *  1. Content-Length declarado > foto + campos  → 413 sin leer el cuerpo.
 *  2. Multer: tamaño máx. 10 MB, 1 archivo, nº/tamaño de campos acotados, y el tipo DECLARADO
 *     por el cliente debe ser imagen (jpeg/png/webp)                       → 413 / 415 / 400.
 *  3. Firma real del archivo ("magic bytes"): el tipo declarado se puede falsificar, el contenido no
 *     → 415 ANTES de llamar a Nominatim o a la base de datos.
 *  4. photoStorageService.savePhoto (file-type + sharp) sigue siendo el validador definitivo.
 */

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MiB
const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 512 * 1024; // foto + campos de texto del formulario
const FIELD_NAME = 'foto';
const ALLOWED_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const MSG_TIPO = 'Solo se permiten imágenes JPEG, PNG o WebP.';

/** Tipo de imagen según los primeros bytes, o null. Solo reconoce los formatos permitidos. */
function sniffImageType(buf) {
  if (!buf || buf.length < 3) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** 1. Rechazo temprano por Content-Length (no sirve con transferencia "chunked": ahí manda Multer). */
function rejectOversizedRequest(req, res, next) {
  const declarado = Number(req.headers['content-length']);
  if (Number.isFinite(declarado) && declarado > MAX_REQUEST_BYTES) {
    res.set('Connection', 'close');
    return next(new AppError(413, 'FILE_TOO_LARGE', 'La solicitud supera el tamaño máximo. La fotografía puede pesar hasta 10 MB.', [
      { field: FIELD_NAME, issue: 'La fotografía puede pesar hasta 10 MB.' },
    ]));
  }
  return next();
}

/** 2. Filtro de Multer por tipo declarado. Es una barrera barata, no la validación definitiva. */
function fileFilter(req, file, cb) {
  const declarado = String(file.mimetype || '').toLowerCase();
  // `application/octet-stream` o vacío: algunos clientes no informan el tipo; decide la firma real (paso 3).
  if (declarado && declarado !== 'application/octet-stream' && !ALLOWED_MIME_TYPES.includes(declarado)) {
    return cb(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', MSG_TIPO, [
      { field: FIELD_NAME, issue: `El tipo "${declarado}" no está permitido.` },
    ]));
  }
  return cb(null, true);
}

const MULTIPART_MALFORMADO = /unexpected end of form|malformed|boundary not found|missing content-type|multipart/i;

/** Convierte los errores de Multer/busboy en AppError con status y mensaje claros. Otros errores pasan igual. */
function translateUploadError(err) {
  if (!err || err instanceof AppError) return err;

  if (err.name === 'MulterError') {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return new AppError(413, 'FILE_TOO_LARGE', 'La fotografía supera los 10 MB.', [
          { field: FIELD_NAME, issue: 'La fotografía puede pesar hasta 10 MB.' },
        ]);
      case 'LIMIT_UNEXPECTED_FILE':
      case 'LIMIT_FILE_COUNT':
        return new AppError(400, 'VALIDATION_ERROR', 'Envía una sola imagen en el campo "foto".', [
          { field: err.field || FIELD_NAME, issue: 'Se esperaba un único archivo en el campo "foto".' },
        ]);
      case 'LIMIT_FIELD_KEY':
      case 'LIMIT_FIELD_VALUE':
      case 'LIMIT_FIELD_COUNT':
      case 'LIMIT_PART_COUNT':
        return new AppError(400, 'VALIDATION_ERROR', 'Los datos del formulario superan el tamaño o la cantidad permitidos.');
      default:
        return new AppError(400, 'VALIDATION_ERROR', 'El formulario enviado no es válido.');
    }
  }

  // Errores de busboy (multipart mal formado) llegan como Error simple: sin esto serían un 500.
  // Los de sistema de archivos (ENOSPC, EACCES…) llevan `code` y siguen siendo 500, como corresponde.
  if (!err.code && !err.status && !err.statusCode && MULTIPART_MALFORMADO.test(String(err.message))) {
    return new AppError(400, 'VALIDATION_ERROR', 'El formulario multipart está mal formado.');
  }
  return err;
}

async function borrarSilencioso(ruta) {
  try { await fsp.rm(ruta, { force: true }); } catch { /* ya no existe */ }
}

/** 3. Verifica la firma real del archivo ya recibido, antes de cualquier trabajo costoso. */
async function verifyUploadedImage(req, res, next) {
  if (!req.file) return next(); // su ausencia la informa reportService (400 "La fotografía es obligatoria.")

  let handle;
  try {
    handle = await fsp.open(req.file.path, 'r');
    const cabecera = Buffer.alloc(12);
    const { bytesRead } = await handle.read(cabecera, 0, 12, 0);
    await handle.close();
    handle = null;

    if (bytesRead === 0) {
      await borrarSilencioso(req.file.path);
      return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'La imagen está vacía.', [
        { field: FIELD_NAME, issue: 'El archivo no tiene contenido.' },
      ]));
    }
    if (!sniffImageType(cabecera.subarray(0, bytesRead))) {
      await borrarSilencioso(req.file.path);
      return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', MSG_TIPO, [
        { field: FIELD_NAME, issue: 'El contenido del archivo no es una imagen JPEG, PNG ni WebP.' },
      ]));
    }
    return next();
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await borrarSilencioso(req.file.path);
    return next(error);
  }
}

/**
 * Devuelve la lista de middlewares de subida: `router.post('/', limiter, ...createPhotoUpload(), controller)`.
 * `multerLib` es inyectable para las pruebas (multer se carga solo si no se entrega).
 */
function createPhotoUpload(multerLib = null) {
  const multer = multerLib ?? require('multer');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOADS_DIR),
      filename: (req, file, cb) => cb(null, crypto.randomUUID()), // nunca el nombre del cliente
    }),
    limits: {
      fileSize: MAX_PHOTO_BYTES,
      files: 1,
      fields: 20, // el formulario ciudadano envía ~12 campos
      fieldSize: 16 * 1024, // la descripción libre es corta
      parts: 25,
    },
    fileFilter,
  }).single(FIELD_NAME);

  const parse = (req, res, next) => upload(req, res, (error) => next(translateUploadError(error)));
  return [rejectOversizedRequest, parse, verifyUploadedImage];
}

module.exports = {
  createPhotoUpload,
  rejectOversizedRequest,
  verifyUploadedImage,
  translateUploadError,
  fileFilter,
  sniffImageType,
  MAX_PHOTO_BYTES,
  MAX_REQUEST_BYTES,
  ALLOWED_MIME_TYPES,
};
