import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
dotenv.config({ path: path.join(projectRoot, '.env') });

function integerEnv(value, fallback, name, min, max) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}.`);
  }
  return parsed;
}

/** Configuración sin imprimir secretos ni incluir credenciales en el código. */
export function getDatabaseConfig(env = process.env) {
  const host = env.PGHOST || '127.0.0.1';
  const database = env.PGDATABASE || 'bache0_dev';
  const user = env.PGUSER || 'bache0_app';
  const password = env.PGPASSWORD;
  if (!password || password === 'REEMPLAZAR_POR_TU_PASSWORD_LOCAL') {
    throw new Error('Configura PGPASSWORD en el archivo .env local antes de conectar PostgreSQL.');
  }
  const sslEnabled = String(env.PGSSL ?? 'false').toLowerCase() === 'true';
  return {
    host,
    port: integerEnv(env.PGPORT, 5432, 'PGPORT', 1, 65535),
    database,
    user,
    password,
    max: integerEnv(env.PGPOOL_MAX, 10, 'PGPOOL_MAX', 1, 50),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 12_000,
    application_name: 'bache0-backend',
    options: '-c timezone=UTC',
    ...(sslEnabled ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

export function createDatabasePool(env = process.env) {
  return new Pool(getDatabaseConfig(env));
}

export const pool = createDatabasePool();

// No se imprimen host+usuario+contraseña ni detalles de consultas.
pool.on('error', (error) => {
  console.error('Error inesperado en una conexión PostgreSQL inactiva:', error.message);
});

export async function closeDatabasePool() {
  await pool.end();
}

export async function pingDatabase(dbPool = pool) {
  const result = await dbPool.query(
    `SELECT current_database() AS database_name,
            current_setting('server_version') AS server_version,
            NOW() AS server_time`,
  );
  return result.rows[0];
}
