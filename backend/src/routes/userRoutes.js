const { Router } = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

const router = Router();

// Contrato 7.4: el CRUD de usuarios es para administrador municipal (de su ámbito) y superadministrador.
// authorize filtra por ROL; el ámbito (misma municipalidad, sin elevar privilegios) lo aplica
// userService usando req.user como actor.
const canManageUsers = authorize('administrador_municipal', 'superadministrador');

// Todas las rutas exigen un JWT válido y una cuenta activa.
router.use(authenticate);

router.post('/', canManageUsers, userController.createUser);          // Crear cuenta municipal
router.get('/', canManageUsers, userController.listUsers);            // Listar (paginado, con ámbito)
router.get('/:id', canManageUsers, userController.getUserById);       // Detalle (404 si es de otra municipalidad)
router.put('/:id', canManageUsers, userController.updateUser);        // Actualizar datos permitidos
router.delete('/:id', canManageUsers, userController.deactivateUser); // Desactivación lógica (204)

module.exports = router;
