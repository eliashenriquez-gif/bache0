const jwt = require('jsonwebtoken');
const AppError = require('./AppError');
const jwtConfig = require('../config/jwt');
const userService = require('../services/userService');

function unauthorized(message = 'Se requiere autenticación válida.') {
  return new AppError(401, 'AUTHENTICATION_REQUIRED', message);
}

/**
 * authenticate
 * 1) Exige el header "Authorization: Bearer <token>".
 * 2) Verifica firma, algoritmo, emisor, audiencia y expiración del JWT.
 * 3) Recarga al usuario desde la fuente de datos en CADA petición (contrato 4.1): el rol y la
 *    municipalidad nunca se toman del token, y una cuenta desactivada deja de funcionar
 *    aunque su JWT no haya expirado.
 * Deja el usuario vigente en req.user = { id, nombre, email, rol, municipalidad_id }.
 */
async function authenticate(req, res, next) {
  const [scheme, token, ...extra] = (req.get('Authorization') || '').split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token || extra.length > 0) {
    throw unauthorized();
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
  } catch (err) {
    throw unauthorized(
      err && err.name === 'TokenExpiredError' ? 'La sesión expiró. Inicia sesión nuevamente.' : undefined
    );
  }

  const user = await userService.findCurrentUser(payload.sub);
  if (!user || !user.activo) {
    throw unauthorized();
  }

  req.user = {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    municipalidad_id: user.municipalidad_id,
  };
  next();
}

module.exports = { authenticate };