const { Router } = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authenticate');
const { loginRateLimiter } = require('../middlewares/loginRateLimiter');

const router = Router();

// POST /api/v1/auth/login — público, con límite de intentos fallidos (contrato 4.1 y 7.2).
router.post('/login', loginRateLimiter, authController.login);

// GET /api/v1/auth/me — cualquier funcionario con JWT válido.
router.get('/me', authenticate, authController.me);

// POST /api/v1/auth/change-password — cambia la contraseña propia; exige la actual.
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
