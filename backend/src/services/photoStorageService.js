const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const AppError = require('../middlewares/AppError');

const storageDir = path.resolve(
  process.env.REPORT_PHOTO_STORAGE_DIR ||
  path.join(__dirname, '../../var/storage/reports')
);

const MAX_FOTO = 10 * 1024 * 1024;

function validarStorageKey(key) {
  if (typeof key !== 'string') {
    throw new AppError(404, 'NOT_FOUND', 'Fotografía no encontrada.');
  }

  // Fotografías nuevas guardadas por el módulo ciudadano.
  const fotoNueva =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$/i.test(key);

  // Fotografías de demostración utilizadas por los datos seed.
  const fotoSeed =
    /^seed\/demo-report-[0-9]+\.png$/.test(key);

  if (!fotoNueva && !fotoSeed) {
    throw new AppError(404, 'NOT_FOUND', 'Fotografía no encontrada.');
  }

  return key;
}

async function savePhoto(file) {
  const bytes = await fs.readFile(file.path);

  if (!bytes.length) {
    throw new AppError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'La imagen está vacía.'
    );
  }

  if (bytes.length > MAX_FOTO) {
    throw new AppError(
      413,
      'FILE_TOO_LARGE',
      'La fotografía supera los 10 MB.'
    );
  }

  const { fileTypeFromBuffer } = await import('file-type');
  const type = await fileTypeFromBuffer(bytes);

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type?.mime)) {
    throw new AppError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Solo se permiten imágenes JPEG, PNG o WebP.'
    );
  }

  let normalized;

  try {
    normalized = await sharp(bytes, { failOn: 'error' })
      .rotate()
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'La imagen está dañada o no es válida.'
    );
  }

  if (normalized.length > MAX_FOTO) {
    throw new AppError(
      413,
      'FILE_TOO_LARGE',
      'La fotografía procesada supera los 10 MB.'
    );
  }

  const metadata = await sharp(normalized).metadata();
  const storage_key = `${crypto.randomUUID()}.jpg`;

  await fs.mkdir(storageDir, { recursive: true });

  await fs.writeFile(
    path.join(storageDir, storage_key),
    normalized,
    { flag: 'wx' }
  );

  return {
    foto_storage_key: storage_key,
    foto_mime_type: 'image/jpeg',
    foto_size_bytes: normalized.length,
    foto_sha256: crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex'),
    foto_ancho_px: metadata.width,
    foto_alto_px: metadata.height,
  };
}

async function deletePhoto(key) {
  if (!key) return;

  const storageKey = validarStorageKey(key);

  await fs.rm(
    path.join(storageDir, storageKey),
    { force: true }
  );
}

async function readPhoto(key) {
  const storageKey = validarStorageKey(key);

  try {
    return await fs.readFile(
      path.join(storageDir, storageKey)
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Fotografía no encontrada.'
      );
    }

    throw error;
  }
}

/** Ruta absoluta de una fotografía ya guardada (la usa el análisis de visión artificial). */
function resolvePhotoPath(key) {
  return path.join(storageDir, validarStorageKey(key));
}

module.exports = {
  savePhoto,
  deletePhoto,
  readPhoto,
  resolvePhotoPath
};

module.exports = {
  savePhoto,
  deletePhoto,
  readPhoto
};