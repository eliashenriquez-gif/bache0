const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/', reportController.obtenerReportes);
router.post('/', reportController.crearReporte);

module.exports = router;