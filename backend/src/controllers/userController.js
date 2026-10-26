const userService = require('../services/userService');

// El controller solo adapta HTTP: toma datos de req, delega en el Service y elige el código de respuesta.
// Express 5 envía automáticamente al errorHandler cualquier error lanzado en funciones async.

/** POST /api/v1/usuarios */
async function createUser(req, res) {
  const user = await userService.createUser(req.body);
  res.status(201).json({ data: user });
}

/** GET /api/v1/usuarios */
async function listUsers(req, res) {
  const { data, pagination } = await userService.listUsers(req.query);
  res.status(200).json({ data, pagination });
}

/** GET /api/v1/usuarios/:id */
async function getUserById(req, res) {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json({ data: user });
}

/** PUT /api/v1/usuarios/:id */
async function updateUser(req, res) {
  const user = await userService.updateUser(req.params.id, req.body);
  res.status(200).json({ data: user });
}

/** DELETE /api/v1/usuarios/:id — desactivación lógica */
async function deactivateUser(req, res) {
  await userService.deactivateUser(req.params.id);
  res.status(204).send();
}

module.exports = { createUser, listUsers, getUserById, updateUser, deactivateUser };