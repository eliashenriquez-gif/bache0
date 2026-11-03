const express = require('express');

const reportController = require('../controllers/reportController');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

const canManageReports = authorize(
  'administrador_municipal',
  'superadministrador'
);

// POST ciudadano: público.
// Temporalmente devuelve 503 hasta integrar el flujo completo.
router.post('/', reportController.crearReporte);

// Todas las siguientes operaciones requieren JWT válido.
router.use(authenticate);

// Lectura: inspector, administrador municipal y superadministrador.
router.get('/', reportController.obtenerReportes);

router.get('/:id/foto', reportController.obtenerFoto);

router.get('/:id', reportController.obtenerReporte);

// Cambio de estado: los tres roles municipales.
router.patch('/:id/estado', reportController.actualizarEstado);

// Modificación administrativa.
router.put(
  '/:id',
  canManageReports,
  reportController.actualizarReporte
);

// Archivo lógico: administrador municipal o superadministrador.
router.delete(
  '/:id',
  canManageReports,
  reportController.archivarReporte
);

module.exports = router;