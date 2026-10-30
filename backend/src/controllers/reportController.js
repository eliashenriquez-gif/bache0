const reporteService = require('../services/reportService');

const obtenerReportes = (req, res) => {
  res.status(200).json({ data: [] }); 
};

const crearReporte = async (req, res) => {
    try {
        const { lat, lng, calle, comuna, descripcion, gravedad } = req.body;
        const foto = req.file; 

        if (!lat || !lng || !foto) {
            return res.status(400).json({ error: "Faltan datos obligatorios." });
        }

        const nuevoReporte = await reporteService.procesarNuevoReporte(
            { lat, lng, calle, comuna, descripcion, gravedad },
            foto
        );

        return res.status(201).json({
            success: true,
            mensaje: 'Reporte ingresado exitosamente',
            folio: nuevoReporte.folio,
            data: nuevoReporte
        });

    } catch (error) {
        console.error("❌ ERROR REAL:", error);
        return res.status(500).json({
            error: "ERROR_REAL",
            mensaje: error.message
        });
    }
};

module.exports = { obtenerReportes, crearReporte };