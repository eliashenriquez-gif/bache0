const { Router } = require('express');
const userController = require('../controllers/userController');

const router = Router();

// TODO(auth): cuando exista el middleware JWT, proteger todas las rutas con
// authenticate + authorize('administrador_municipal', 'superadministrador'), y aplicar
// el aislamiento por municipalidad (contrato, secciones 4.3 y 7.4).
// Hasta entonces, probar solo en local (contrato, sección 4.4).

router.post('/', userController.createUser);        // Crear cuenta municipal
router.get('/', userController.listUsers);          // Listar (paginado)
router.get('/:id', userController.getUserById);     // Detalle
router.put('/:id', userController.updateUser);      // Actualizar datos permitidos
router.delete('/:id', userController.deactivateUser); // Desactivación lógica (204)

module.exports = router;