const authService = require('../services/authService');

// El controller solo adapta HTTP; la verificación de credenciales y la emisión del JWT viven en el Service.

/** POST /api/v1/auth/login */
async function login(req, res) {
  const result = await authService.login(req.body);
  res.status(200).json({ data: result });
}

module.exports = { login };
    