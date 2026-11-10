import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '../../..');
const schema = fs.readFileSync(path.join(projectRoot, 'db', 'schema.sql'), 'utf8');
const seed = fs.readFileSync(path.join(projectRoot, 'db', 'seed.sql'), 'utf8');
const contract = fs.readFileSync(path.join(projectRoot, 'docs', 'contrato-api-rest-v1.md'), 'utf8');
const openapi = fs.readFileSync(path.join(projectRoot, 'docs', 'openapi.yaml'), 'utf8');

test('schema incluye las cinco tablas canónicas del contrato', () => {
  for (const table of ['municipalidades', 'usuarios', 'reportes', 'analisis_vision', 'auditoria_eventos']) {
    assert.match(schema, new RegExp(`CREATE TABLE ${table}\\s*\\(`, 'i'), `Falta la tabla ${table}`);
  }
});

test('tablas mutables tienen triggers updated_at y auditoría es append-only', () => {
  for (const table of ['municipalidades', 'usuarios', 'reportes', 'analisis_vision']) {
    assert.match(schema, new RegExp(`trg_${table}_updated_at`, 'i'));
  }
  assert.match(schema, /trg_auditoria_inmutable/i);
  assert.match(schema, /impedir_mutacion_auditoria/i);
});

test('schema no añade cuentas ciudadanas y seed incluye una comuna sin cobertura', () => {
  assert.doesNotMatch(schema, /usuarios_ciudadanos|ciudadano_id/i);
  assert.match(seed, /'providencia'.*TRUE, FALSE/s);
  assert.match(contract, /El ciudadano no crea cuentas, no inicia sesión/);
});

test('seed usa claves de fotos de ejemplo y no guarda binarios en PostgreSQL', () => {
  assert.match(seed, /foto_storage_key/);
  assert.match(schema, /binario en PostgreSQL/i);
  assert.match(seed, /demo-report-001\.png/);
});

test('las reglas de tamaño de imagen, MIME y coordenadas se imponen en SQL', () => {
  assert.match(schema, /foto_size_bytes BETWEEN 1 AND 10485760/);
  assert.match(schema, /image\/jpeg', 'image\/png', 'image\/webp/);
  assert.match(schema, /latitud BETWEEN -90 AND 90/);
  assert.match(schema, /longitud BETWEEN -180 AND 180/);
});

test('reportes conserva los campos explicables de prioridad', () => {
  assert.match(schema, /prioridad\s+VARCHAR\(20\) NULL/i);
  assert.match(schema, /motivos\s+JSONB NOT NULL DEFAULT '\[\]'::JSONB/i);
  assert.match(schema, /version_reglas\s+VARCHAR\(80\) NULL/i);
  assert.match(schema, /ck_reportes_motivos_array/i);
  assert.match(contract, /version_reglas/);
  assert.match(openapi, /prioridad:[\s\S]{0,220}readOnly: true/);
  assert.match(openapi, /motivos:[\s\S]{0,220}readOnly: true/);
  assert.match(openapi, /version_reglas:[\s\S]{0,220}readOnly: true/);
});

test('la migración de prioridad existe y es idempotente', () => {
  const migrationPath = path.join(projectRoot, 'db', 'migrations', '20261109_001_reportes_prioridad_motivos_version_reglas.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS prioridad/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS motivos/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS version_reglas/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_reportes_municipalidad_prioridad_fecha/i);
});
