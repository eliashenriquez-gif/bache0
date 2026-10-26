const argon2 = require('argon2');
const AppError = require('../middlewares/AppError');

// ---------------------------------------------------------------------------
// Constantes de negocio (contrato v1.1)
// ---------------------------------------------------------------------------
const ROLES = ['inspector', 'administrador_municipal', 'superadministrador'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const CREATE_FIELDS = ['nombre', 'email', 'password', 'rol', 'municipalidad_id'];
// PUT no acepta password (se cambia en /auth/change-password) ni activo (se desactiva con DELETE).
const UPDATE_FIELDS = ['nombre', 'email', 'rol', 'municipalidad_id'];

// ---------------------------------------------------------------------------
// TEMPORAL: "repositorio" en memoria.
// Simula la tabla `usuarios`. Cuando Elías entregue el Repository de PostgreSQL,
// se reemplaza este bloque por: const userRepository = require('../repositories/userRepository');
// manteniendo la misma interfaz (insert, findById, findAll, update).
// Un email repetido lanza un error con code '23505', igual que PostgreSQL al violar UNIQUE;
// el Service lo traduce a 409 (ver mapUniqueViolation).
// ---------------------------------------------------------------------------
const store = [];
let nextId = 1;

function uniqueViolation() {
  return Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
}

const userRepository = {
  async insert(data) {
    if (store.some((u) => u.email === data.email)) throw uniqueViolation();
    const now = new Date().toISOString();
    const record = { id: nextId++, ...data, activo: true, created_at: now, updated_at: now };
    store.push(record);
    return { ...record };
  },

  async findById(id) {
    const record = store.find((u) => u.id === id);
    return record ? { ...record } : null;
  },

  async findAll({ rol, activo, offset, limit }) {
    const filtered = store.filter(
      (u) => (rol === undefined || u.rol === rol) && (activo === undefined || u.activo === activo)
    );
    return { rows: filtered.slice(offset, offset + limit).map((u) => ({ ...u })), total: filtered.length };
  },

  async update(id, changes) {
    const record = store.find((u) => u.id === id);
    if (!record) return null;
    if (changes.email && store.some((u) => u.id !== id && u.email === changes.email)) throw uniqueViolation();
    Object.assign(record, changes, { updated_at: new Date().toISOString() });
    return { ...record };
  },
};

// ---------------------------------------------------------------------------
// Helpers de validación
// ---------------------------------------------------------------------------
function validationError(details) {
  return new AppError(400, 'VALIDATION_ERROR', 'Hay campos que requieren corrección.', details);
}

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Usuario no encontrado.');
}

function mapUniqueViolation(err) {
  if (err && err.code === '23505') {
    return new AppError(409, 'CONFLICT', 'Ya existe una cuenta con ese correo electrónico.', [
      { field: 'email', issue: 'Ya está registrado.' },
    ]);
  }
  return err;
}

/** Los IDs de path son enteros positivos; cualquier otra cosa es 400. */
function parseId(rawId) {
  if (!/^[1-9]\d*$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId))) {
    throw validationError([{ field: 'id', issue: 'Debe ser un entero positivo.' }]);
  }
  return Number(rawId);
}

/** Express 5 deja req.body en undefined si no hubo body; aquí se normaliza a objeto. */
function ensureObject(body) {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw validationError([{ field: 'body', issue: 'Debe ser un objeto JSON.' }]);
  }
  return body;
}

function validateNombre(value, details) {
  if (typeof value !== 'string' || value.trim() === '') {
    details.push({ field: 'nombre', issue: 'Es obligatorio.' });
    return undefined;
  }
  return value.trim();
}

function validateEmail(value, details) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(normalized)) {
    details.push({ field: 'email', issue: 'Debe ser un correo electrónico válido.' });
    return undefined;
  }
  return normalized;
}

function validatePassword(value, details) {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    details.push({
      field: 'password',
      issue: `Debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`,
    });
  }
}

function validateRol(value, details) {
  if (!ROLES.includes(value)) {
    details.push({ field: 'rol', issue: `Debe ser uno de: ${ROLES.join(', ')}.` });
    return false;
  }
  return true;
}

/** Contrato: municipalidad_id no nulo para roles municipales y nulo solo para superadministrador. */
function validateRoleScope(rol, municipalidadId, details) {
  if (!ROLES.includes(rol)) return;
  if (rol === 'superadministrador') {
    if (municipalidadId !== null && municipalidadId !== undefined) {
      details.push({ field: 'municipalidad_id', issue: 'Un superadministrador no pertenece a una municipalidad (debe ser null).' });
    }
  } else if (!Number.isInteger(municipalidadId) || municipalidadId <= 0) {
    details.push({ field: 'municipalidad_id', issue: 'Es obligatorio y debe ser un entero positivo.' });
  }
}

/** Whitelist de campos que pueden salir del Service. Nunca incluye password_hash. */
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

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

/** POST /usuarios */
async function createUser(body) {
  const input = ensureObject(body);
  const details = [];

  const nombre = validateNombre(input.nombre, details);
  const email = validateEmail(input.email, details);
  validatePassword(input.password, details);
  validateRol(input.rol, details);
  const municipalidadId = input.municipalidad_id === undefined ? null : input.municipalidad_id;
  validateRoleScope(input.rol, municipalidadId, details);

  if (details.length > 0) throw validationError(details);

  // Argon2id: la contraseña en texto plano no sale de esta función.
  const password_hash = await argon2.hash(input.password, { type: argon2.argon2id });

  try {
    const created = await userRepository.insert({
      nombre,
      email,
      rol: input.rol,
      municipalidad_id: municipalidadId,
      password_hash,
    });
    return toPublicUser(created);
  } catch (err) {
    throw mapUniqueViolation(err);
  }
}

/** GET /usuarios?page=&limit=&rol=&activo= */
async function listUsers(query) {
  const q = query || {};
  const details = [];

  const page = q.page === undefined ? 1 : Number(q.page);
  if (!Number.isInteger(page) || page < 1) {
    details.push({ field: 'page', issue: 'Debe ser un entero mayor o igual a 1.' });
  }

  const limit = q.limit === undefined ? DEFAULT_LIMIT : Number(q.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    details.push({ field: 'limit', issue: `Debe ser un entero entre 1 y ${MAX_LIMIT}.` });
  }

  if (q.rol !== undefined && !ROLES.includes(q.rol)) {
    details.push({ field: 'rol', issue: `Debe ser uno de: ${ROLES.join(', ')}.` });
  }

  if (q.activo !== undefined && q.activo !== 'true' && q.activo !== 'false') {
    details.push({ field: 'activo', issue: "Debe ser 'true' o 'false'." });
  }

  if (details.length > 0) throw validationError(details);

  const { rows, total } = await userRepository.findAll({
    rol: q.rol,
    activo: q.activo === undefined ? undefined : q.activo === 'true',
    offset: (page - 1) * limit,
    limit,
  });

  return {
    data: rows.map(toPublicUser),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}

/** GET /usuarios/:id */
async function getUserById(rawId) {
  const id = parseId(rawId);
  const user = await userRepository.findById(id);
  if (!user) throw notFound();
  return toPublicUser(user);
}

/** PUT /usuarios/:id — actualización parcial de datos permitidos. */
async function updateUser(rawId, body) {
  const id = parseId(rawId);
  const input = ensureObject(body);
  const details = [];

  const keys = Object.keys(input);
  if (keys.length === 0) {
    details.push({ field: 'body', issue: 'Debe enviar al menos un campo a actualizar.' });
  }
  keys
    .filter((key) => !UPDATE_FIELDS.includes(key))
    .forEach((key) => details.push({ field: key, issue: 'Campo no permitido en esta operación.' }));

  const changes = {};
  if ('nombre' in input) changes.nombre = validateNombre(input.nombre, details);
  if ('email' in input) changes.email = validateEmail(input.email, details);
  if ('rol' in input) validateRol(input.rol, details) && (changes.rol = input.rol);
  if ('municipalidad_id' in input) {
    const value = input.municipalidad_id;
    const isValid = value === null || (Number.isInteger(value) && value > 0);
    if (!isValid) details.push({ field: 'municipalidad_id', issue: 'Debe ser un entero positivo o null.' });
    else changes.municipalidad_id = value;
  }

  if (details.length > 0) throw validationError(details);

  const existing = await userRepository.findById(id);
  if (!existing) throw notFound();

  // Consistencia rol <-> municipalidad sobre el resultado final (valores nuevos + los que ya tenía).
  const finalRol = changes.rol ?? existing.rol;
  const finalMunicipalidad = 'municipalidad_id' in changes ? changes.municipalidad_id : existing.municipalidad_id;
  const scopeDetails = [];
  validateRoleScope(finalRol, finalMunicipalidad, scopeDetails);
  if (scopeDetails.length > 0) throw validationError(scopeDetails);

  try {
    const updated = await userRepository.update(id, changes);
    return toPublicUser(updated);
  } catch (err) {
    throw mapUniqueViolation(err);
  }
}

/** DELETE /usuarios/:id — desactivación lógica (activo = false). Idempotente. */
async function deactivateUser(rawId) {
  const id = parseId(rawId);
  const user = await userRepository.findById(id);
  if (!user) throw notFound();
  if (user.activo) {
    await userRepository.update(id, { activo: false });
  }
}

module.exports = { createUser, listUsers, getUserById, updateUser, deactivateUser };