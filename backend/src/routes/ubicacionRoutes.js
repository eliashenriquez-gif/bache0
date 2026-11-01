const express = require('express');
const router = express.Router();
const ubicacionController = require('../controllers/ubicacionController');

router.post('/resolver', ubicacionController.resolver);

module.exports = router;
