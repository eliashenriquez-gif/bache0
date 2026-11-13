'use strict';

// Prueba manual del motor de visión (NO es un test automático; por eso vive en scripts/):
//   node scripts/probar-vision.js [ruta-de-imagen]
// Sin argumento usa una foto de demostración. Mide primero la carga del modelo y luego una
// segunda inferencia con el worker ya caliente.
const path = require('node:path');
const { analyzeImage, cerrarVision } = require('../src/services/visionService');

async function main() {
  const imagen = process.argv[2]
    ?? path.join(__dirname, '..', 'fixtures', 'seed-photos', 'demo-report-001.png');
  console.log(`Imagen: ${imagen}`);

  for (const intento of ['1ª (carga el modelo)', '2ª (worker caliente)']) {
    const t0 = Date.now();
    const resultado = await analyzeImage(imagen);
    console.log(`\n${intento}: ${((Date.now() - t0) / 1000).toFixed(2)} s`);
    console.dir(resultado, { depth: null });
  }
  await cerrarVision();
}

main().catch((error) => { console.error('La prueba falló:', error); process.exit(1); });
