const path = require('node:path');
const crypto = require('node:crypto');

// Cargar las variables de entorno
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const express = require('express');
const cors = require('cors');

const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const ubicacionRoutes = require('./routes/ubicacionRoutes');
const visionRoutes = require('./routes/visionRoutes');
const visionService = require('./services/visionService');

const {
  errorHandler,
  notFoundHandler,
} = require('./middlewares/errorHandler');

const { seedSuperadmin } = require('./bootstrap/seedSuperadmin');

const app = express();
// 1. ARRANCAR PUERTO CORRECTAMENTE (P0)
const PORT = Number(process.env.PORT) || 3000;

// 2. SEGURIDAD Y LIMITES BASE (P0)
const helmet = require('helmet');
app.use(helmet()); // Agregado Helmet para cabeceras de seguridad
// El CORS está abierto ahora, pero idealmente process.env.CORS_ORIGIN
app.use(cors()); 
app.use(express.json({ limit: '12mb' })); // Límite para evitar ataques de JSON gigante

// 3. MIDDLEWARE DE REQUEST ID PARA AUDITORÍA (P0)
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  next();
});

// 4. ENDPOINT DE HEALTH CHECK (P0 - Exigido por contrato H2)
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', visionRoutes);
app.use('/api/v1/reportes', reportRoutes);
app.use('/api/v1/usuarios', userRoutes);
app.use('/api/v1/ubicaciones', ubicacionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    await seedSuperadmin();
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    visionService.precalentar();
  });
}

start().catch((err) => {
  console.error(`No se pudo iniciar el servidor: ${err.message}`);
  process.exit(1);
});