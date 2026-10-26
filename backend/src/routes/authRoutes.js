const { Router } = require('express');
const authController = require('../controllers/authController');
const { loginRateLimiter } = require('../middlewares/loginRateLimiter');

const router = Router();

// POST /api/v1/auth/login — público, con límite de intentos fallidos (contrato 4.1 y 7.2).
router.post('/login', loginRateLimiter, authController.login);

module.exports = router;
