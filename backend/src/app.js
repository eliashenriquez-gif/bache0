const path = require('node:path');

// Cargar las variables de entorno antes de importar rutas y middlewares.
// El archivo .env está en la raíz del proyecto.
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const express = require('express');
const cors = require('cors');

const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const ubicacionRoutes = require('./routes/ubicacionRoutes');

const {
  errorHandler,
  notFoundHandler,
} = require('./middlewares/errorHandler');

const { seedSuperadmin } = require('./bootstrap/seedSuperadmin');

const app = express();
const PORT = 3000;

// Middlewares generales
app.use(cors());
app.use(express.json());

// Rutas API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reportes', reportRoutes);
app.use('/api/v1/usuarios', userRoutes);
app.use('/api/v1/ubicaciones', ubicacionRoutes);

// Manejo de rutas y errores
app.use(notFoundHandler);
app.use(errorHandler);

// Inicio del servidor
async function start() {
  // En desarrollo, asegurar la existencia del superadministrador inicial.
  // En producción, se crea mediante el procedimiento de inicialización correspondiente.
  if (process.env.NODE_ENV !== 'production') {
    await seedSuperadmin();
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(`No se pudo iniciar el servidor: ${err.message}`);
  process.exit(1);
});