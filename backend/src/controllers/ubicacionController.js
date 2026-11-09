const { resolverUbicacion } = require('../services/locationService');
const AppError = require('../middlewares/AppError');
async function resolver(req, res, next) {
  try {
    const body = req.body || {};
    const latitud = Number(body.latitud), longitud = Number(body.longitud);
    const precision = body.precision_ubicacion_m == null ? null : Number(body.precision_ubicacion_m);
    if (body.latitud == null || body.longitud == null || body.latitud === '' || body.longitud === '' ||
        !['gps','pin_manual'].includes(body.metodo_ubicacion) ||
        (body.precision_ubicacion_m === '' && body.precision_ubicacion_m != null)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Faltan datos obligatorios de ubicación.');
    }
    const data = await resolverUbicacion(latitud, longitud, body.metodo_ubicacion, precision);
    res.status(200).json({ data });
  } catch (error) { next(error); }
}
module.exports = { resolver };
