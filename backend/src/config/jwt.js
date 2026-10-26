// Configuración de JWT (contrato v1.1, sección 4.1).
// JWT_SECRET solo existe en el entorno del servidor: nunca se escribe en el repositorio
// ni se envía al frontend.

const MIN_SECRET_LENGTH = 32;
const secret = process.env.JWT_SECRET;

if (!secret || secret.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `JWT_SECRET no está definido o tiene menos de ${MIN_SECRET_LENGTH} caracteres. ` +
      "Genera uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\" " +
      'y guárdalo en tu archivo .env'
  );
}

module.exports = Object.freeze({
  secret,
  algorithm: 'HS256',
  issuer: 'bache0-api',
  audience: 'bache0-panel-municipal',
  expiresInSeconds: 30 * 60, // vigencia de 30 minutos, sin refresh token
});