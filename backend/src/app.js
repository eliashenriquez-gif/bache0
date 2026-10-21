const express = require('express');
const cors = require('cors');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Conectamos la ruta oficial de tu contrato API
app.use('/api/v1/reportes', reportRoutes);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});