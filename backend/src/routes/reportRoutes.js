
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const reportController = require('../controllers/reportController');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

// Carpeta para almacenar fotografías
const uploadsDir = path.join(__dirname, '../../uploads');

// Crear carpeta si no existe
fs.mkdirSync(uploadsDir, { recursive: true });

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const nombreUnico = `${crypto.randomUUID()}${extension}`;
    cb(null, nombreUnico);
  }
});

// Configuración de Multer
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

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
  upload.single('foto'),
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
