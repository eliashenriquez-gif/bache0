const AppError = require('./AppError');
// In-memory, single-process limiter for citizen endpoints.
function citizenRateLimiter(max, windowMs = 60000) {
  const attempts = new Map();
  return function limit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(key, entry);
    }
    if (entry.count >= max) {
      const error = new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Demasiadas solicitudes. Intenta nuevamente más tarde.');
      error.retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return next(error);
    }
    entry.count++;
    // Avoid indefinite growth when traffic contains many different IPs.
    if (attempts.size > 5000) {
      for (const [ip, value] of attempts) if (value.resetAt <= now) attempts.delete(ip);
    }
    return next();
  };
}
module.exports = { citizenRateLimiter };
