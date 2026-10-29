const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AppError = require('../middlewares/AppError');
const jwtConfig = require('../config/jwt');
const userService = require('./userService');

const MAX_PASSWORD_LENGTH = 128;

function validateLoginBody(body) {
  const input = body === undefined || body === null ? {} : body;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Hay campos que requieren corrección.', [
      { field: 'body', issue: 'Debe ser un objeto JSON.' },
    ]);
  }

  const details = [];
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (email === '') {
    details.push({ field: 'email', issue: 'Es obligatorio.' });
  }
  if (typeof input.password !== 'string' || input.password.length === 0 || input.password.length > MAX_PASSWORD_LENGTH) {
    details.push({ field: 'password', issue: `Es obligatorio y debe tener como máximo ${MAX_PASSWORD_LENGTH} caracteres.` });
  }
  if (details.length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Hay campos que requieren corrección.', details);
  }

  return { email, password: input.password };
}

/** POST /auth/login */
async function login(body) {
  const { email, password } = validateLoginBody(body);

  // Devuelve null si el correo no existe, la contraseña es incorrecta o la cuenta está inactiva:
  // en los tres casos la respuesta es la misma para no revelar si el correo existe.
  const user = await userService.verifyCredentials(email, password);
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  }

  // El token solo lleva claims estándar (sub, iss, aud, iat, exp, jti). Rol y municipalidad
  // se consultan en cada petición protegida, no se confía en el token para eso.
  const accessToken = jwt.sign({}, jwtConfig.secret, {
    algorithm: jwtConfig.algorithm,
    subject: String(user.id),
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    expiresIn: jwtConfig.expiresInSeconds,
    jwtid: crypto.randomUUID(),
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: jwtConfig.expiresInSeconds,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      municipalidad_id: user.municipalidad_id,
    },
  };
}

/** GET /auth/me — perfil vigente del funcionario autenticado (sin hash ni secretos). */
async function getProfile(actor) {
  const user = await userService.findCurrentUser(actor.id);
  if (!user) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Se requiere autenticación válida.');
  }
  return user;
}

/** POST /auth/change-password — body: { current_password, new_password } */
async function changePassword(actor, body) {
  const input = body === undefined || body === null ? {} : body;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Hay campos que requieren corrección.', [
      { field: 'body', issue: 'Debe ser un objeto JSON.' },
    ]);
  }
  await userService.changePassword(actor.id, input.current_password, input.new_password);
}

module.exports = { login, getProfile, changePassword };
