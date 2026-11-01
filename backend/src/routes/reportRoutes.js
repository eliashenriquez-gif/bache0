const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const reportController = require('../controllers/reportController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')), 
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', reportController.obtenerReportes);
// AQUÍ ESTÁ EL CAMBIO: quitamos el /upload
router.post('/', upload.single('foto'), reportController.crearReporte);

module.exports = router;