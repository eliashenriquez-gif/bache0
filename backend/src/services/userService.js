const argon2 = require('argon2');
const AppError = require('../middlewares/AppError');

// ---------------------------------------------------------------------------
// Constantes de negocio (contrato v1.1)
// ---------------------------------------------------------------------------
const ROLES = ['inspector', 'administrador_municipal', 'superadministrador'];
const MANAGER_ROLES = ['administrador_municipal', 'superadministrador'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// PUT no acepta password (se cambia en /auth/change-password) ni activo (se desactiva con DELETE).
const UPDATE_FIELDS = ['nombre', 'email', 'rol', 'municipalidad_id'];

// ---------------------------------------------------------------------------
// TEMPORAL: "repositorio" en memoria.
// Simula la tabla `usuarios`. Cuando Elías entregue el Repository de PostgreSQL,
// se reemplaza este bloque por: const userRepository = require('../repositories/userRepository');
// manteniendo la misma interfaz (insert, findById, findByEmail, findAll, update).
// findAll debe aceptar los filtros rol, activo y municipalidad_id (el ámbito se aplica también ahí).
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

  async findByEmail(email) {
    const record = store.find((u) => u.email === email);
    return record ? { ...record } : null;
  },

  async findAll({ rol, activo, municipalidad_id, offset, limit }) {
    const filtered = store.filter(
      (u) =>
        (rol === undefined || u.rol === rol) &&
        (activo === undefined || u.activo === activo) &&
        (municipalidad_id === undefined || u.municipalidad_id === municipalidad_id)
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
// Errores y helpers de validación
// ---------------------------------------------------------------------------
function validationError(details) {
  return new AppError(400, 'VALIDATION_ERROR', 'Hay campos que requieren corrección.', details);
}

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Usuario no encontrado.');
}

function forbidden(message, details = []) {
  return new AppError(403, 'FORBIDDEN', message, details);
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

function validatePassword(value, details, field = 'password') {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    details.push({
      field,
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
// Ámbito y permisos (contrato 4.2, 4.3 y 7.4)
//   superadministrador:      gestiona cualquier cuenta.
//   administrador_municipal: ve las cuentas de su municipalidad, pero solo crea y gestiona
//                            inspectores de esa misma municipalidad; no concede permisos
//                            globales ni cambia cuentas a otra municipalidad.
//   Fuera de ámbito -> 404 (no se revela que existe). Acción no permitida -> 403.
// `actor` es req.user: { id, rol, municipalidad_id, ... }
// ---------------------------------------------------------------------------
function assertCanManageUsers(actor) {
  const validAdmin =
    actor && actor.rol === 'administrador_municipal' && Number.isInteger(actor.municipalidad_id);
  const validSuper = actor && actor.rol === 'superadministrador';
  if (!validAdmin && !validSuper) {
    throw forbidden('No tienes permiso para realizar esta acción.');
  }
}

function isInScope(actor, user) {
  if (actor.rol === 'superadministrador') return true;
  return user.municipalidad_id === actor.municipalidad_id;
}

/** Carga un usuario dentro del ámbito del actor; si no existe o es de otra municipalidad, 404. */
async function findManagedUser(actor, id) {
  const user = await userRepository.findById(id);
  if (!user || !isInScope(actor, user)) throw notFound();
  return user;
}

function assertAdminTargetIsInspector(actor, target) {
  if (actor.rol === 'administrador_municipal' && target.rol !== 'inspector') {
    throw forbidden('Un administrador municipal solo puede gestionar cuentas de inspector.');
  }
}

// ---------------------------------------------------------------------------
// Creación (compartida por createUser y bootstrapSuperadmin)
// ---------------------------------------------------------------------------
function validateNewUser(input) {
  const details = [];
  const nombre = validateNombre(input.nombre, details);
  const email = validateEmail(input.email, details);
  validatePassword(input.password, details);
  validateRol(input.rol, details);
  const municipalidadId = input.municipalidad_id === undefined ? null : input.municipalidad_id;
  validateRoleScope(input.rol, municipalidadId, details);

  if (details.length > 0) throw validationError(details);
  return { nombre, email, password: input.password, rol: input.rol, municipalidad_id: municipalidadId };
}

/** Argon2id: la contraseña en texto plano no sale de esta función. */
async function persistNewUser({ password, ...data }) {
  const password_hash = await argon2.hash(password, { type: argon2.argon2id });
  try {
    const created = await userRepository.insert({ ...data, password_hash });
    return toPublicUser(created);
  } catch (err) {
    throw mapUniqueViolation(err);
  }
}

// ---------------------------------------------------------------------------
// Casos de uso del CRUD
// ---------------------------------------------------------------------------

/** POST /usuarios */
async function createUser(actor, body) {
  assertCanManageUsers(actor);
  const input = { ...ensureObject(body) };

  if (actor.rol === 'administrador_municipal') {
    if (ROLES.includes(input.rol) && input.rol !== 'inspector') {
      throw forbidden('No tienes permiso para crear usuarios con ese rol.', [
        { field: 'rol', issue: 'Un administrador municipal solo puede crear inspectores.' },
      ]);
    }
    if (input.municipalidad_id === undefined) {
      input.municipalidad_id = actor.municipalidad_id; // por defecto, su propia municipalidad
    } else if (input.municipalidad_id !== actor.municipalidad_id) {
      throw forbidden('No puedes crear usuarios en otra municipalidad.', [
        { field: 'municipalidad_id', issue: 'Debe coincidir con tu municipalidad.' },
      ]);
    }
  }

  return persistNewUser(validateNewUser(input));
}

/** GET /usuarios?page=&limit=&rol=&activo=&municipalidad_id= */
async function listUsers(actor, query) {
  assertCanManageUsers(actor);
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

  let requestedMunicipalidad;
  if (q.municipalidad_id !== undefined) {
    if (!/^[1-9]\d*$/.test(String(q.municipalidad_id)) || !Number.isSafeInteger(Number(q.municipalidad_id))) {
      details.push({ field: 'municipalidad_id', issue: 'Debe ser un entero positivo.' });
    } else {
      requestedMunicipalidad = Number(q.municipalidad_id);
    }
  }

  if (details.length > 0) throw validationError(details);

  // El ámbito del administrador municipal sale de su cuenta, no de un filtro libre del cliente.
  let municipalidadFilter = requestedMunicipalidad;
  if (actor.rol === 'administrador_municipal') {
    if (requestedMunicipalidad !== undefined && requestedMunicipalidad !== actor.municipalidad_id) {
      throw forbidden('No tienes permiso para consultar otra municipalidad.', [
        { field: 'municipalidad_id', issue: 'Solo puedes consultar tu propia municipalidad.' },
      ]);
    }
    municipalidadFilter = actor.municipalidad_id;
  }

  const { rows, total } = await userRepository.findAll({
    rol: q.rol,
    activo: q.activo === undefined ? undefined : q.activo === 'true',
    municipalidad_id: municipalidadFilter,
    offset: (page - 1) * limit,
    limit,
  });

  return {
    data: rows.map(toPublicUser),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}

/** GET /usuarios/:id */
async function getUserById(actor, rawId) {
  assertCanManageUsers(actor);
  const id = parseId(rawId);
  const user = await findManagedUser(actor, id);
  return toPublicUser(user);
}

/** PUT /usuarios/:id — actualización parcial de datos permitidos. */
async function updateUser(actor, rawId, body) {
  assertCanManageUsers(actor);
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

  const existing = await findManagedUser(actor, id); // 404 si no existe o es de otra municipalidad

  if (actor.rol === 'administrador_municipal') {
    assertAdminTargetIsInspector(actor, existing);
    if ('rol' in changes && changes.rol !== 'inspector') {
      throw forbidden('No puedes asignar ese rol.', [
        { field: 'rol', issue: 'Un administrador municipal no puede elevar privilegios.' },
      ]);
    }
    if ('municipalidad_id' in changes && changes.municipalidad_id !== actor.municipalidad_id) {
      throw forbidden('No puedes mover cuentas a otra municipalidad.', [
        { field: 'municipalidad_id', issue: 'Debe coincidir con tu municipalidad.' },
      ]);
    }
  }

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
async function deactivateUser(actor, rawId) {
  assertCanManageUsers(actor);
  const id = parseId(rawId);
  const user = await findManagedUser(actor, id);
  assertAdminTargetIsInspector(actor, user);
  if (user.activo) {
    await userRepository.update(id, { activo: false });
  }
}

// ---------------------------------------------------------------------------
// Soporte para autenticación (lo usan authService y el middleware authenticate)
// El hash nunca sale de este archivo: estas funciones devuelven usuarios públicos o null.
// ---------------------------------------------------------------------------

// Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe
// y así no revelar qué cuentas están registradas.
let dummyHashPromise;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash('contrasena-ficticia-para-igualar-tiempos', { type: argon2.argon2id });
  }
  return dummyHashPromise;
}

async function passwordMatches(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false; // hash malformado u otro fallo de verificación: se trata como credencial inválida
  }
}

/**
 * Verifica email + contraseña. Devuelve el usuario público si las credenciales son válidas
 * y la cuenta está activa; en cualquier otro caso devuelve null.
 */
async function verifyCredentials(email, password) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const record = await userRepository.findByEmail(normalizedEmail);
  const hash = record ? record.password_hash : await getDummyHash();
  const passwordOk = await passwordMatches(hash, password);

  if (!record || !passwordOk || !record.activo) return null;
  return toPublicUser(record);
}

/** Usuario vigente según el id del token (sub). Devuelve null si el id es inválido o no existe. */
async function findCurrentUser(rawId) {
  if (!/^[1-9]\d*$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId))) return null;
  const user = await userRepository.findById(Number(rawId));
  return user ? toPublicUser(user) : null;
}

/** POST /auth/change-password — cambia la contraseña PROPIA exigiendo la actual. */
async function changePassword(userId, currentPassword, newPassword) {
  const details = [];
  if (typeof currentPassword !== 'string' || currentPassword.length === 0 || currentPassword.length > PASSWORD_MAX_LENGTH) {
    details.push({ field: 'current_password', issue: 'Es obligatoria.' });
  }
  validatePassword(newPassword, details, 'new_password');
  if (details.length === 0 && currentPassword === newPassword) {
    details.push({ field: 'new_password', issue: 'Debe ser distinta de la contraseña actual.' });
  }
  if (details.length > 0) throw validationError(details);

  const record = await userRepository.findById(userId);
  if (!record || !record.activo) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Se requiere autenticación válida.');
  }
  if (!(await passwordMatches(record.password_hash, currentPassword))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'La contraseña actual es incorrecta.');
  }

  const password_hash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await userRepository.update(userId, { password_hash });
}

// ---------------------------------------------------------------------------
// Inicialización controlada del primer superadministrador (contrato 4.1).
// No pasa por HTTP: solo la llama el proceso local de siembra (src/bootstrap/seedSuperadmin.js).
// Devuelve el usuario creado, o null si ya existe algún superadministrador.
// ---------------------------------------------------------------------------
async function bootstrapSuperadmin({ nombre, email, password } = {}) {
  const { total } = await userRepository.findAll({ rol: 'superadministrador', offset: 0, limit: 1 });
  if (total > 0) return null;

  const data = validateNewUser({ nombre, email, password, rol: 'superadministrador', municipalidad_id: null });
  return persistNewUser(data);
}

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  deactivateUser,
  verifyCredentials,
  findCurrentUser,
  changePassword,
  bootstrapSuperadmin,
};
