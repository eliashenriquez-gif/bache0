const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const reportController = require('../controllers/reportController');

// Configuramos Multer para guardar directamente en la carpeta uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Guarda directamente en backend/uploads
        cb(null, path.join(__dirname, '../../uploads')); 
    },
    filename: function (req, file, cb) {
        // Nombre único para evitar sobreescribir
        const uniqueSuffix = crypto.randomUUID();
        const extension = path.extname(file.originalname);
        cb(null, uniqueSuffix + extension);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.get('/', reportController.obtenerReportes);
router.post('/', upload.single('foto'), reportController.crearReporte);

module.exports = router;