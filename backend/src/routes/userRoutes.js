const { Router } = require('express');
const userController = require('../controllers/userController');

const router = Router();

// POST /api/v1/usuarios — Crear cuenta municipal.
// TODO(auth): cuando exista el middleware JWT, proteger esta ruta con
// authenticate + authorize('administrador_municipal', 'superadministrador').
// Hasta entonces, probar solo en local (contrato, sección 4.4).
router.post('/', userController.createUser);

module.exports = router;
