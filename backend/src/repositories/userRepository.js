
'use strict';

// Pool compartido con la configuración PostgreSQL del proyecto.
// Se importa dinámicamente porque database.js utiliza módulos ES
// y este repositorio debe ser compatible con userService.js (CommonJS).
let cachedPool;

async function getPool() {
  if (!cachedPool) {
    const database = await import('../config/database.js');
    cachedPool = database.pool;
  }

  return cachedPool;
}

const SELECT_COLUMNS = `
  id,
  municipalidad_id,
  nombre_completo AS nombre,
  email,
  password_hash,
  rol,
  activo,
  created_at,
  updated_at
`;

const UPDATE_COLUMNS = Object.freeze({
  nombre: 'nombre_completo',
  email: 'email',
  rol: 'rol',
  municipalidad_id: 'municipalidad_id',
  password_hash: 'password_hash',
  activo: 'activo',
});

/**
 * Inserta un usuario.
 * La contraseña debe llegar ya cifrada con Argon2id desde userService.
 */
async function insert(data) {
  const pool = await getPool();

  const result = await pool.query(
    `INSERT INTO usuarios (
       municipalidad_id,
       nombre_completo,
       email,
       password_hash,
       rol
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLUMNS}`,
    [
      data.municipalidad_id ?? null,
      data.nombre,
      data.email,
      data.password_hash,
      data.rol,
    ],
  );

  return result.rows[0];
}

/**
 * Busca un usuario por ID.
 */
async function findById(id) {
  const pool = await getPool();

  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS}
       FROM usuarios
      WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

/**
 * Busca por correo normalizado.
 * email_normalizado es una columna generada en PostgreSQL.
 */
async function findByEmail(email) {
  const pool = await getPool();

  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS}
       FROM usuarios
      WHERE email_normalizado = lower(btrim($1))`,
    [email],
  );

  return result.rows[0] ?? null;
}

/**
 * Lista usuarios con filtros y paginación.
 * Devuelve el formato que espera userService: { rows, total }.
 */
async function findAll({
  rol,
  activo,
  municipalidad_id,
  offset = 0,
  limit = 20,
} = {}) {
  const pool = await getPool();

  if (!Number.isInteger(offset) || offset < 0) {
    throw new TypeError('offset debe ser un entero mayor o igual a cero.');
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('limit debe ser un entero entre 1 y 100.');
  }

  const conditions = [];
  const values = [];

  if (rol !== undefined) {
    values.push(rol);
    conditions.push(`rol = $${values.length}`);
  }

  if (activo !== undefined) {
    values.push(activo);
    conditions.push(`activo = $${values.length}`);
  }

  if (municipalidad_id !== undefined) {
    if (municipalidad_id === null) {
      conditions.push('municipalidad_id IS NULL');
    } else {
      values.push(municipalidad_id);
      conditions.push(`municipalidad_id = $${values.length}`);
    }
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM usuarios
       ${whereClause}`,
    values,
  );

  const listValues = [...values, limit, offset];

  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS}
       FROM usuarios
       ${whereClause}
      ORDER BY id ASC
      LIMIT $${listValues.length - 1}
      OFFSET $${listValues.length}`,
    listValues,
  );

  return {
    rows: result.rows,
    total: countResult.rows[0].total,
  };
}

/**
 * Actualiza únicamente las columnas permitidas.
 * También mantiene la consistencia entre activo y desactivado_at.
 */
async function update(id, changes) {
  const pool = await getPool();

  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new TypeError('changes debe ser un objeto.');
  }

  const keys = Object.keys(changes);

  if (keys.length === 0) {
    return findById(id);
  }

  const values = [id];
  const setClauses = [];

  for (const key of keys) {
    const column = UPDATE_COLUMNS[key];

    if (!column) {
      throw new Error(`Campo no actualizable en userRepository: ${key}`);
    }

    values.push(changes[key]);
    const placeholder = `$${values.length}`;

    setClauses.push(`${column} = ${placeholder}`);

    if (key === 'activo') {
      setClauses.push(
        `desactivado_at = CASE
          WHEN ${placeholder}::boolean THEN NULL
          ELSE COALESCE(desactivado_at, CURRENT_TIMESTAMP)
        END`,
      );
    }
  }

  const result = await pool.query(
    `UPDATE usuarios
        SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING ${SELECT_COLUMNS}`,
    values,
  );

  return result.rows[0] ?? null;
}

module.exports = {
  insert,
  findById,
  findByEmail,
  findAll,
  update,
};
