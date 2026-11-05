const AppError = require('../middlewares/AppError');

const MUNICIPIOS_CON_COBERTURA = ['La Pintana', 'Puente Alto', 'Santiago', 'San Bernardo'];

async function resolverUbicacion(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const respuesta = await fetch(url, { headers: { 'User-Agent': 'Bache0-GovTech-App/1.0' } });

        if (!respuesta.ok) throw new AppError(503, 'PROVEEDOR_CAIDO', 'El servicio de mapas está temporalmente caído.');
        
        const data = await respuesta.json();

        if (!data || !data.address || !data.address.road) {
            throw new AppError(404, 'UBICACION_NO_RESUELTA', 'No pudimos encontrar una calle en esa ubicación.');
        }

        const calle = data.address.road;
        const comuna = data.address.city || data.address.town || data.address.village || data.address.county;

        if (!MUNICIPIOS_CON_COBERTURA.includes(comuna)) {
            throw new AppError(403, 'COMUNA_SIN_COBERTURA', 'Esa comuna aún no tiene cobertura.');
        }

        return { calle, comuna, lat, lng };

    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(503, 'PROVEEDOR_CAIDO', 'Error de conexión con el proveedor de mapas.');
    }
}

module.exports = { resolverUbicacion };