import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '../../');
dotenv.config({ path: path.join(projectRoot, '.env') });
const fixturesDir = path.join(projectRoot, 'backend', 'fixtures', 'seed-photos');
const storageRoot = path.resolve(projectRoot, process.env.STORAGE_ROOT || 'backend/var/storage/reports');
const destinationDir = path.join(storageRoot, 'seed');

await fs.mkdir(destinationDir, { recursive: true });
for (const name of ['demo-report-001.png', 'demo-report-002.png', 'demo-report-003.png']) {
  const source = path.join(fixturesDir, name);
  const destination = path.join(destinationDir, name);
  await fs.copyFile(source, destination);
  console.log(`Foto de ejemplo preparada: ${path.relative(projectRoot, destination)}`);
}
console.log('Listo. Estas imágenes son ilustraciones ficticias para pruebas, no fotografías reales de ciudadanos.');
