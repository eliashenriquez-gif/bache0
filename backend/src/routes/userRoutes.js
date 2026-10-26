const { Router } = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

const router = Router();

// Contrato 7.4: el CRUD de usuarios es para administrador municipal (de su ámbito) y superadministrador.
const canManageUsers = authorize('administrador_municipal', 'superadministrador');

// Todas las rutas exigen un JWT válido y una cuenta activa.
router.use(authenticate);

// TODO(scope): authorize solo valida el ROL. Falta aplicar el ámbito (contrato 4.3):
// un administrador municipal solo gestiona usuarios de su municipalidad, solo crea inspectores
// propios y no puede elevar privilegios. Eso requiere pasar req.user al Service.

router.post('/', canManageUsers, userController.createUser);          // Crear cuenta municipal
router.get('/', canManageUsers, userController.listUsers);            // Listar (paginado)
router.get('/:id', canManageUsers, userController.getUserById);       // Detalle
router.put('/:id', canManageUsers, userController.updateUser);        // Actualizar datos permitidos
router.delete('/:id', canManageUsers, userController.deactivateUser); // Desactivación lógica (204)

module.exports = router;
