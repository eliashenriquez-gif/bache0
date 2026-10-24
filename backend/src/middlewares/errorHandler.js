const { v4: uuidv4 } = require('uuid');

// Código y mensaje por defecto para cada HTTP status que usa el contrato v1.
const DEFAULTS_BY_STATUS = {
  400: {
    code: 'VALIDATION_ERROR',
    message: 'Hay campos que requieren corrección.',
  },
  401: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Se requiere autenticación válida.',
  },
  403: {
    code: 'FORBIDDEN',
    message: 'No tienes permiso para realizar esta acción.',
  },
  404: {
    code: 'NOT_FOUND',
    message: 'El recurso solicitado no existe.',
  },
  409: {
    code: 'CONFLICT',
    message: 'La operación entra en conflicto con el estado actual del recurso.',
  },
  413: {
    code: 'FILE_TOO_LARGE',
    message: 'El contenido enviado supera el tamaño máximo permitido.',
  },
  415: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Tipo de archivo no permitido. Usa JPEG, PNG o WebP.',
  },
  422: {
    code: 'UNPROCESSABLE_ENTITY',
    message: 'La solicitud no cumple las reglas de negocio.',
  },
  429: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
  },
  500: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Ocurrió un error inesperado. Intenta nuevamente más tarde.',
  },
  503: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'El servicio no está disponible temporalmente.',
  },
};

/**
 * Traduce errores conocidos de librerías (body-parser, multer) a un
 * status y mensaje del contrato. Devuelve null si no corresponde.
 */
function fromKnownLibraryError(err) {
  // JSON mal formado en el body.
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return {
      status: 400,
      message: 'El cuerpo de la solicitud no es un JSON válido.',
    };
  }

  // Errores de multer al subir fotografías.
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return {
        status: 413,
        message: 'La foto supera el tamaño máximo permitido de 10 MB.',
      };
    }

    return {
      status: 400,
      message: 'El archivo enviado no es válido.',
    };
  }

  return null;
}

/**
 * Normaliza los errores para responder según el contrato de la API.
 * Los errores internos no exponen detalles de PostgreSQL ni del código.
 */
function normalizeError(err) {
  const known = fromKnownLibraryError(err);
  const rawStatus = known
    ? known.status
    : err && (err.statusCode || err.status);

  let status;

  if (DEFAULTS_BY_STATUS[rawStatus]) {
    status = rawStatus;
  } else if (
    Number.isInteger(rawStatus) &&
    rawStatus >= 400 &&
    rawStatus < 500
  ) {
    status = 400;
  } else {
    status = 500;
  }

  const defaults = DEFAULTS_BY_STATUS[status];
  const isOperational = Boolean(err && err.isOperational);

  return {
    status,
    code: isOperational && err.code ? err.code : defaults.code,
    message: known
      ? known.message
      : isOperational && err.message
        ? err.message
        : defaults.message,
    details:
      isOperational && Array.isArray(err.details)
        ? err.details
        : [],
  };
}

/**
 * Middleware para rutas inexistentes.
 * Evita que Express devuelva su página HTML predeterminada.
 */
function notFoundHandler(req, res, next) {
  const err = new Error('La ruta solicitada no existe.');
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  err.isOperational = true;

  next(err);
}

/**
 * Middleware global para manejar errores.
 * Debe registrarse al final de app.js.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Si ya comenzó a enviarse la respuesta, delega el error.
  if (res.headersSent) {
    return next(err);
  }

  const requestId = uuidv4();
  const { status, code, message, details } = normalizeError(err);

  // No registrar el cuerpo de la solicitud: podría contener datos sensibles.
  const logLine =
    `[${requestId}] ${req.method} ${req.originalUrl} -> ${status} ${code}`;

  if (status >= 500) {
    console.error(
      logLine,
      '\n',
      err && err.stack ? err.stack : err,
    );
  } else {
    console.warn(logLine);
  }

  if (status === 429 && err && err.retryAfter) {
    res.set('Retry-After', String(err.retryAfter));
  }

  return res.status(status).json({
    error: {
      code,
      message,
      details,
      request_id: requestId,
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};