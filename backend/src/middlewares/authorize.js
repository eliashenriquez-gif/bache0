const AppError = require('./AppError');

/**
 * authorize(...roles)
 * Fábrica de middleware: permite el acceso solo si el rol vigente de req.user está en la lista.
 * Debe ir DESPUÉS de authenticate.
 *
 * Ejemplo: router.delete('/:id', authorize('administrador_municipal', 'superadministrador'), handler);
 */
function authorize(...allowedRoles) {
  const roles = allowedRoles.flat();
  if (roles.length === 0) {
    throw new Error('authorize() requiere al menos un rol permitido.');
  }

  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Se requiere autenticación válida.'));
    }
    if (!roles.includes(req.user.rol)) {
      return next(new AppError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.'));
    }
    return next();
  };
}

module.exports = { authorize };
