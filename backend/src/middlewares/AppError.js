/**
 * AppError
 * Error "operacional": lo lanzamos a propósito desde Controllers/Services
 * cuando ya sabemos qué código HTTP y qué mensaje debe ver el cliente.
 * errorHandler solo expone code/message/details de errores con
 * isOperational = true; cualquier otro error se responde como 500 genérico.
 *
 * Ejemplo:
 *   throw new AppError(400, 'VALIDATION_ERROR', 'Hay campos que requieren corrección.', [
 *     { field: 'severidad', issue: 'Debe ser baja, media o alta.' },
 *   ]);
 */
class AppError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
