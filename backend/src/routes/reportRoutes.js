
const express = require('express');

const reportController = require('../controllers/reportController');
const { citizenRateLimiter } = require('../middlewares/citizenRateLimiter');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { createPhotoUpload } = require('../middlewares/uploadValidation');

const router = express.Router();

// Subida de la fotografía: tamaño máx. 10 MB, solo JPEG/PNG/WebP (ver middlewares/uploadValidation.js).
const uploadPhoto = createPhotoUpload();

// Permisos administrativos
const canManageReports = authorize(
  'administrador_municipal',
  'superadministrador'
);

/**
 * RUTA PÚBLICA
 * POST /api/v1/reportes
 * Crear reporte ciudadano con fotografía.
 */
router.post(
  '/',
  citizenRateLimiter(Number(process.env.REPORT_RATE_LIMIT_PER_10_MINUTES) || 5, 10 * 60 * 1000),
  ...uploadPhoto,
  reportController.crearReporte
);

// Todas las rutas siguientes requieren JWT
router.use(authenticate);

/**
 * GET /api/v1/reportes
 * Consultar reportes.
 */
router.get(
  '/',
  reportController.obtenerReportes
);

/**
 * GET /api/v1/reportes/:id/foto
 * Recuperar fotografía.
 */
router.get(
  '/:id/foto',
  reportController.obtenerFoto
);

/**
 * GET /api/v1/reportes/:id
 * Consultar reporte individual.
 */
router.get(
  '/:id',
  reportController.obtenerReporte
);

/**
 * PATCH /api/v1/reportes/:id/estado
 * Actualizar estado del reporte.
 */
router.patch(
  '/:id/estado',
  reportController.actualizarEstado
);

/**
 * PUT /api/v1/reportes/:id
 * Actualización administrativa.
 */
router.put(
  '/:id',
  canManageReports,
  reportController.actualizarReporte
);

/**
 * DELETE /api/v1/reportes/:id
 * Archivado lógico.
 */
router.delete(
  '/:id',
  canManageReports,
  reportController.archivarReporte
);

module.exports = router;
