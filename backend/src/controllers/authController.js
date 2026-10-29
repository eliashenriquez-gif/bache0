const authService = require('../services/authService');

// El controller solo adapta HTTP; la verificación de credenciales, la emisión del JWT
// y el cambio de contraseña viven en el Service.

/** POST /api/v1/auth/login */
async function login(req, res) {
  const result = await authService.login(req.body);
  res.status(200).json({ data: result });
}

/** GET /api/v1/auth/me */
async function me(req, res) {
  const profile = await authService.getProfile(req.user);
  res.status(200).json({ data: profile });
}

/** POST /api/v1/auth/change-password */
async function changePassword(req, res) {
  await authService.changePassword(req.user, req.body);
  res.status(200).json({ data: { message: 'Contraseña actualizada correctamente.' } });
}

module.exports = { login, me, changePassword };
