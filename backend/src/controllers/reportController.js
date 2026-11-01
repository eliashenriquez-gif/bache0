const reporteService = require('../services/reportService');

const obtenerReportes = (req, res) => {
  res.status(200).json({ data: [] }); 
};

const crearReporte = async (req, res, next) => {
    try {
        const { lat, lng, gravedad, descripcion } = req.body;
        const foto = req.file; 

        if (!lat || !lng || !foto) {
            return res.status(400).json({ error: "Faltan datos obligatorios." });
        }

        // Traducimos los nombres del frontend a los del contrato API
        const datosContrato = {
            latitud: lat,
            longitud: lng,
            severidad: gravedad,
            descripcion: descripcion
        };

        const nuevoReporte = await reporteService.procesarNuevoReporte(datosContrato, foto);

        return res.status(201).json({
            success: true,
            mensaje: 'Reporte ingresado exitosamente',
            folio: nuevoReporte.folio,
            data: nuevoReporte
        });

    } catch (error) {
        next(error);
    }
};

module.exports = { obtenerReportes, crearReporte };