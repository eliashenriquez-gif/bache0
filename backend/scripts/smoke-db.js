import { pool, pingDatabase, closeDatabasePool } from '../src/config/database.js';

async function verifyUpdatedAtTrigger() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeResult = await client.query(
      `SELECT id, updated_at FROM reportes WHERE archivado_at IS NULL ORDER BY id LIMIT 1 FOR UPDATE`,
    );
    if (beforeResult.rowCount === 0) {
      throw new Error('No hay reportes seed para probar el trigger updated_at; ejecuta db/seed.sql.');
    }
    const { id, updated_at: before } = beforeResult.rows[0];
    await client.query('SELECT pg_sleep(0.02)');
    await client.query('UPDATE reportes SET descripcion = descripcion WHERE id = $1', [id]);
    const afterResult = await client.query('SELECT updated_at FROM reportes WHERE id = $1', [id]);
    const after = new Date(afterResult.rows[0].updated_at).getTime();
    if (after <= new Date(before).getTime()) {
      throw new Error('El trigger updated_at no avanzó al actualizar un reporte.');
    }
    await client.query('ROLLBACK'); // La prueba no deja cambios de auditoría ni mutaciones en seed.
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preservar error original. */ }
    throw error;
  } finally {
    client.release();
  }
}

try {
  const info = await pingDatabase(pool);
  const tables = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  const required = ['analisis_vision', 'auditoria_eventos', 'municipalidades', 'reportes', 'usuarios'];
  const existing = new Set(tables.rows.map((row) => row.table_name));
  const missing = required.filter((name) => !existing.has(name));
  if (missing.length) throw new Error(`Faltan tablas: ${missing.join(', ')}. Ejecuta db/schema.sql primero.`);

  const [municipalities, reports, users] = await Promise.all([
    pool.query('SELECT COUNT(*)::integer AS total FROM municipalidades'),
    pool.query('SELECT COUNT(*)::integer AS total FROM reportes'),
    pool.query('SELECT COUNT(*)::integer AS total FROM usuarios'),
  ]);
  if (Number(municipalities.rows[0].total) < 4) throw new Error('Se esperaban al menos cuatro municipalidades seed, incluida una sin cobertura para probar el rechazo.');
  if (Number(reports.rows[0].total) < 3) throw new Error('Se esperaban al menos tres reportes seed para probar persistencia/listado.');
  await verifyUpdatedAtTrigger();

  console.log('Conexión PostgreSQL: OK');
  console.log(`Base de datos: ${info.database_name}`);
  console.log(`Versión PostgreSQL: ${info.server_version}`);
  console.log(`Tablas requeridas: ${required.length}/${required.length}`);
  console.log(`Municipalidades: ${municipalities.rows[0].total}`);
  console.log(`Reportes: ${reports.rows[0].total}`);
  console.log(`Usuarios municipales: ${users.rows[0].total}`);
  console.log('Trigger updated_at: OK (prueba transaccional revertida, sin cambiar datos).');
} catch (error) {
  console.error('Prueba de conexión/estructura fallida:', error.message);
  process.exitCode = 1;
} finally {
  await closeDatabasePool();
}
