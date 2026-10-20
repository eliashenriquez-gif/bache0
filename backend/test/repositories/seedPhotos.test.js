import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '../../..');
const seedSql = fs.readFileSync(path.join(projectRoot, 'db', 'seed.sql'), 'utf8');
const fixtures = [
  { file: 'demo-report-001.png', size: 3660, sha256: 'ffd3286825bdb9b6e0e0cea9d7a1067dedac4a175548d5c77b203e47d7298b24' },
  { file: 'demo-report-002.png', size: 3793, sha256: '6db922141d2a2f77d7bd375a3b559be15103a1ea2598faed6de116688b839a79' },
  { file: 'demo-report-003.png', size: 3774, sha256: 'aa27f2cd9fbc2571e56a379a682587aa55b6c21746fbac727002cdbfdbe7738d' },
];

test('las fotografías seed coinciden en tamaño y SHA-256 con db/seed.sql', () => {
  for (const fixture of fixtures) {
    const filename = path.join(projectRoot, 'backend', 'fixtures', 'seed-photos', fixture.file);
    const bytes = fs.readFileSync(filename);
    assert.equal(bytes.length, fixture.size, `${fixture.file}: tamaño diferente`);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.sha256, `${fixture.file}: hash diferente`);
    assert.ok(seedSql.includes(fixture.file), `${fixture.file}: no está referenciada por seed.sql`);
    assert.ok(seedSql.includes(fixture.sha256), `${fixture.file}: SHA-256 no coincide con seed.sql`);
  }
});
