const express = require('express');
const router = express.Router();
const ubicacionController = require('../controllers/ubicacionController');
const { citizenRateLimiter } = require('../middlewares/citizenRateLimiter');

router.post('/resolver', citizenRateLimiter(Number(process.env.LOCATION_RATE_LIMIT_PER_MINUTE) || 20), ubicacionController.resolver);

module.exports = router;
