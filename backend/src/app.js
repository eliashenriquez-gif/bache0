const path = require('node:path');
const crypto = require('node:crypto');

// Variables de entorno: primero backend/.env (el que usa el equipo) y luego el .env de la raíz del repo.
// dotenv no pisa lo ya definido, así que gana backend/.env y los scripts (smoke:db, seed:photos) usan lo mismo.
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

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
const PORT = Number(process.env.PORT) || 3000;

// Detrás de un proxy o túnel (p. ej. Cloudflare Tunnel) req.ip sería siempre la IP del túnel y el
// límite de solicitudes trataría a todos los ciudadanos como uno solo. Con cloudflared en el mismo equipo:
// TRUST_PROXY=loopback. Acepta un número de saltos, "true" o una lista de subredes (ver docs de Express).
if (process.env.TRUST_PROXY) {
  const valor = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(valor) ? Number(valor) : valor === 'true' ? true : valor);
}

// Identificador de la solicitud: primero de todo, para que auditoría, logs y errores compartan el mismo id.
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.set('X-Request-Id', req.requestId);
  next();
});

app.use(helmet());

// CORS_ORIGINS="https://tu-app.vercel.app,http://localhost:5173". Sin definir queda abierto (solo desarrollo).
const origenesPermitidos = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && origenesPermitidos.length === 0) {
  console.warn('[app] CORS_ORIGINS no está definido: la API acepta solicitudes desde cualquier origen.');
}
app.use(cors({
  origin: origenesPermitidos.length > 0 ? origenesPermitidos : true,
  exposedHeaders: ['Location', 'X-Request-Id', 'Retry-After'],
}));

// Solo los endpoints JSON pasan por aquí (login, usuarios, cambios de estado); la foto viaja como
// multipart y tiene su propio límite de 10 MB. 100 kb sobra para JSON y evita cuerpos gigantes.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));

// Comprobación de salud (contrato H2: GET /health). También en /api/v1/health.
const health = (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
app.get('/health', health);
app.get('/api/v1/health', health);

// Rutas API
app.use('/api/v1/auth', authRoutes);
// Visión artificial (contrato 7.5): antes de reportRoutes, que exige JWT para todo lo que entra a /reportes.
app.use('/api/v1', visionRoutes);
app.use('/api/v1/reportes', reportRoutes);
app.use('/api/v1/usuarios', userRoutes);
app.use('/api/v1/ubicaciones', ubicacionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Red de seguridad: una promesa rechazada sin manejar en una tarea de fondo (p. ej. el análisis de IA)
// termina el proceso en Node ≥ 15. Se registra y el servidor sigue atendiendo reportes.
process.on('unhandledRejection', (motivo) => {
  console.error('[proceso] Promesa rechazada sin manejar:', motivo instanceof Error ? motivo.stack : motivo);
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    await seedSuperadmin();
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    // Carga TensorFlow y el modelo en segundo plano: el primer reporte no paga el arranque.
    visionService.precalentar();
  });
}

start().catch((err) => {
  console.error(`No se pudo iniciar el servidor: ${err.message}`);
  process.exit(1);
});
