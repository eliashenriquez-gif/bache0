import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMunicipalityCoverage, listCoveredMunicipalities } from '../../src/repositories/municipalityRepository.js';

const rows = [
  {
    id: 1,
    nombre: 'Municipalidad de Estación Central',
    comuna: 'Estación Central',
    region: 'Región Metropolitana de Santiago',
    comuna_key: 'estacion_central',
    geocodificacion_aliases: ['Estacion Central'],
    activa: true,
    servicio_activo: true,
  },
  {
    id: 4,
    nombre: 'Municipalidad de Providencia',
    comuna: 'Providencia',
    region: 'Región Metropolitana de Santiago',
    comuna_key: 'providencia',
    geocodificacion_aliases: [],
    activa: true,
    servicio_activo: false,
  },
];

const pool = {
  async query(sql) {
    if (sql.includes('FROM municipalidades')) return { rows };
    throw new Error('Consulta inesperada');
  },
};

test('resuelve comuna con acentos y acepta alias geográfico', async () => {
  const result = await resolveMunicipalityCoverage(pool, {
    comuna: 'Estacion Central',
    region: 'Región Metropolitana',
  });
  assert.equal(result.status, 'covered');
  assert.equal(result.municipality.id, 1);
});

test('identifica una comuna existente sin servicio sin marcarla como desconocida', async () => {
  const result = await resolveMunicipalityCoverage(pool, {
    comuna: 'Providencia',
    region: 'Región Metropolitana de Santiago',
  });
  assert.equal(result.status, 'not_covered');
  assert.equal(result.municipality.servicio_activo, false);
});

test('no inventa cobertura si la comuna/región no se puede resolver', async () => {
  const result = await resolveMunicipalityCoverage(pool, {
    comuna: 'Comuna Inexistente',
    region: 'Región Metropolitana de Santiago',
  });
  assert.deepEqual(result, { status: 'unknown', municipality: null });
});

test('la lista pública solo incluye municipalidades activas con servicio habilitado', async () => {
  const publicPool = {
    async query(sql) {
      assert.match(sql, /activa IS TRUE AND servicio_activo IS TRUE/);
      return { rows: [rows[0]] };
    },
  };
  const result = await listCoveredMunicipalities(publicPool);
  assert.equal(result.length, 1);
  assert.equal(result[0].comuna, 'Estación Central');
});
