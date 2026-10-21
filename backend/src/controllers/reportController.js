const obtenerReportes = (req, res) => {
    res.status(200).json({ data: [] });
};

const crearReporte = (req, res) => {
    const nuevoReporte = req.body;
    if (!nuevoReporte.latitud || !nuevoReporte.longitud || !nuevoReporte.gravedad) {
        return res.status(400).json({
            error: "Validación fallida: Los campos 'latitud', 'longitud' y 'gravedad' son obligatorios."
        });
    }
    res.status(201).json({
        mensaje: "Reporte creado exitosamente",
        data: { id: Date.now(), estado: "Pendiente", ...nuevoReporte }
    });
};

module.exports = { obtenerReportes, crearReporte };