// backend/test-vision.js
require('dotenv').config(); // Carga tu GEMINI_API_KEY desde el .env
const path = require('path');
const { analyzeImage } = require('./src/services/visionService.js');

async function probarIA() {
  try {
    // Apuntamos a la imagen de prueba que tu script de seed prepara
    const imagePath = path.join(__dirname, 'var', 'storage', 'reports', 'seed', 'demo-report-001.png');
    
    console.log(`Iniciando prueba aislada con TensorFlow Local...`);
    console.log(`Ruta de la imagen: ${imagePath}`);
    
    const startTime = Date.now();
    const resultado = await analyzeImage(imagePath);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n¡Análisis completado en ${tiempo} segundos!`);
    console.log('--- RESULTADO ---');
    console.dir(resultado, { depth: null, colors: true });
    console.log('-----------------');
    
  } catch (error) {
    console.error('La prueba falló:', error);
  }
}

probarIA();