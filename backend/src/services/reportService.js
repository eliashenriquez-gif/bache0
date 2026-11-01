const AppError = require('../middlewares/AppError');

function generarFolio() {
    const año = new Date().getFullYear();
    const correlativo = Math.floor(Math.random() * 9000) + 1000; 
    return `PH-${año}-${correlativo}`;
}

async function procesarNuevoReporte(datos, foto) {
    if (!foto) throw new AppError(400, 'FALTA_FOTOGRAFIA', 'La fotografía es obligatoria.');
    const urlFoto = `/uploads/${foto.filename}`;

    return {
        folio: generarFolio(),
        fotoUrl: urlFoto,
        latitud: datos.latitud,
        longitud: datos.longitud,
        severidad: datos.severidad, 
        descripcion: datos.descripcion,
        estado: 'PENDIENTE'
    };
}
module.exports = { procesarNuevoReporte };
