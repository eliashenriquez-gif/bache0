const argon2 = require('argon2');
const AppError = require('../middlewares/AppError');
const userService = require('../services/userService');

const ROLES = ['inspector', 'administrador_municipal', 'superadministrador'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Valida y normaliza el body de POST /usuarios.
 * Devuelve { value, details }: si details tiene elementos, la petición es inválida.
 * Solo se copian los campos permitidos; cualquier otro (id, activo, password_hash...) se ignora.
 */
function validateCreateUserBody(body) {
  const { nombre, email, password, rol, municipalidad_id } = body || {};
  const details = [];

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    details.push({ field: 'nombre', issue: 'Es obligatorio.' });
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    details.push({ field: 'email', issue: 'Debe ser un correo electrónico válido.' });
  }

  if (
    typeof password !== 'string' ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    details.push({
      field: 'password',
      issue: `Debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`,
    });
  }

  if (!ROLES.includes(rol)) {
    details.push({ field: 'rol', issue: `Debe ser uno de: ${ROLES.join(', ')}.` });
  }

  // Contrato: municipalidad_id obligatorio para roles municipales; nulo solo para superadministrador.
  let normalizedMunicipalidadId = null;
  if (rol === 'superadministrador') {
    if (municipalidad_id !== undefined && municipalidad_id !== null) {
      details.push({ field: 'municipalidad_id', issue: 'Un superadministrador no pertenece a una municipalidad.' });
    }
  } else if (ROLES.includes(rol)) {
    if (!Number.isInteger(municipalidad_id) || municipalidad_id <= 0) {
      details.push({ field: 'municipalidad_id', issue: 'Es obligatorio y debe ser un entero positivo.' });
    } else {
      normalizedMunicipalidadId = municipalidad_id;
    }
  }

  return {
    details,
    value: {
      nombre: typeof nombre === 'string' ? nombre.trim() : nombre,
      email: normalizedEmail,
      password,
      rol,
      municipalidad_id: normalizedMunicipalidadId,
    },
  };
}

/** Whitelist de campos que pueden salir hacia el cliente. Nunca incluye el hash. */
function toPublicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    municipalidad_id: user.municipalidad_id,
    activo: user.activo,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

/**
 * POST /api/v1/usuarios
 * Crea una cuenta municipal. Los errores (AppError o inesperados) se propagan
 * al errorHandler gracias a express-async-errors.
 */
async function createUser(req, res) {
  const { value, details } = validateCreateUserBody(req.body);
  if (details.length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Hay campos que requieren corrección.', details);
  }

  // La contraseña en texto plano no sale de este scope: al service solo viaja el hash.
  const { password, ...userData } = value;
  const password_hash = await argon2.hash(password, { type: argon2.argon2id });

  // Si el email ya existe, el service debe lanzar AppError(409, 'CONFLICT', ...).
  const createdUser = await userService.createUser({ ...userData, password_hash });

  return res.status(201).json({ data: toPublicUser(createdUser) });
}

module.exports = { createUser };