require('dotenv').config();
const express = require('express');
const cors = require('cors');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { seedSuperadmin } = require('./bootstrap/seedSuperadmin');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reportes', reportRoutes);
app.use('/api/v1/usuarios', userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  // Mientras los usuarios vivan en memoria, la siembra debe ocurrir dentro de este mismo proceso.
  // Solo en desarrollo: en producción el superadministrador se crea con el comando puntual.
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
