const express = require('express');
const cors = require('cors');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/api/v1/reportes', reportRoutes);
app.use('/api/v1/usuarios', userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
