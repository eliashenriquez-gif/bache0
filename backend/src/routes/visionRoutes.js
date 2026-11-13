'use strict';

const express = require('express');

const visionController = require('../controllers/visionController');
const { citizenRateLimiter } = require('../middlewares/citizenRateLimiter');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

/**
 * Contrato 7.5 (Visión artificial). Se monta en /api/v1 ANTES de reportRoutes:
 * cada ruta declara su propio authenticate (no se usa router.use) para no afectar al resto de la API.
 *
 *  GET  /api/v1/reportes/:id/analisis-vision   inspector | administrador_municipal | superadministrador
 *  GET  /api/v1/analisis-vision/:id            inspector | administrador_municipal | superadministrador
 *  POST /api/v1/reportes/:id/analisis-vision   administrador_municipal | superadministrador
 *       (ejecuta inferencia en CPU: se limita; para permitirlo al inspector agrega 'inspector' a canRequest)
 */
const router = express.Router();

const canRead = authorize('inspector', 'administrador_municipal', 'superadministrador');
const canRequest = authorize('administrador_municipal', 'superadministrador');
const requestLimiter = citizenRateLimiter(Number(process.env.VISION_REQUEST_RATE_LIMIT_PER_MINUTE) || 10, 60 * 1000);

router.get('/reportes/:id/analisis-vision', authenticate, canRead, visionController.listarPorReporte);
router.post('/reportes/:id/analisis-vision', authenticate, canRequest, requestLimiter, visionController.solicitar);
router.get('/analisis-vision/:id', authenticate, canRead, visionController.obtener);

module.exports = router;
