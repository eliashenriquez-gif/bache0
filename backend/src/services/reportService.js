const AppError = require('../middlewares/AppError');
const fs = require('fs');
const { fileTypeFromFile } = require('file-type');

function generarFolio() {
    const año = new Date().getFullYear();
    const correlativo = Math.floor(Math.random() * 9000) + 1000; 
    return `PH-${año}-${correlativo}`;
}

async function procesarNuevoReporte(datos, foto) {
    // 1. Validar que la foto exista
    if (!foto) throw new AppError(400, 'FALTA_FOTOGRAFIA', 'La fotografía es obligatoria.');
    
    // 2. Validar tamaño máximo (10MB) por si acaso
    if (foto.size > 10 * 1024 * 1024) {
        fs.unlinkSync(foto.path); // Borramos el archivo pesado
        throw new AppError(413, 'FOTO_MUY_PESADA', 'La fotografía supera el límite de 10MB.');
    }

    // 3. Validar Magic Numbers (que sea una imagen real: JPEG, PNG o WebP)
    const type = await fileTypeFromFile(foto.path);
    const formatosPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (!type || !formatosPermitidos.includes(type.mime)) {
        fs.unlinkSync(foto.path); // Borramos el archivo falso del disco
        throw new AppError(400, 'FORMATO_FOTO_INVALIDO', 'El archivo no es una imagen válida (JPEG, PNG o WebP).');
    }

    // 4. Si todo está bien, generamos la URL y el reporte
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
