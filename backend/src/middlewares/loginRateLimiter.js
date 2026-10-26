const AppError = require('./AppError');

// Contrato 4.1: máximo 5 intentos fallidos por combinación de origen (IP) y cuenta en 15 minutos.
// Solo cuentan los intentos que terminan en 401; un login exitoso reinicia el contador.
// Almacenamiento en memoria: válido para una sola instancia del servidor.
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const failedAttempts = new Map(); // key -> { count, resetAt }

function buildKey(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${req.ip}|${email}`;
}

// Limpieza periódica de ventanas vencidas; unref() para no impedir que el proceso termine.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failedAttempts) {
    if (entry.resetAt <= now) failedAttempts.delete(key);
  }
}, 60 * 1000).unref();

function loginRateLimiter(req, res, next) {
  const key = buildKey(req);
  const now = Date.now();
  const entry = failedAttempts.get(key);

  if (entry && entry.resetAt <= now) {
    failedAttempts.delete(key);
  } else if (entry && entry.count >= MAX_FAILED_ATTEMPTS) {
    const err = new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Demasiados intentos fallidos. Intenta nuevamente más tarde.');
    err.retryAfter = Math.ceil((entry.resetAt - now) / 1000); // el errorHandler lo envía como Retry-After
    return next(err);
  }

  res.on('finish', () => {
    if (res.statusCode === 401) {
      const current = failedAttempts.get(key);
      if (current && current.resetAt > Date.now()) {
        current.count += 1;
      } else {
        failedAttempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
      }
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      failedAttempts.delete(key);
    }
  });

  return next();
}

module.exports = { loginRateLimiter };
