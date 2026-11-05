
const locationService = require('../services/locationService');

/**
 * POST /api/v1/ubicaciones/resolver
 * Resuelve coordenadas geográficas.
 */
const resolver = async (req, res, next) => {
  try {
    const { lat, lng } = req.body || {};

    // Comprobar que se enviaron las coordenadas
    if (
      lat === undefined ||
      lng === undefined ||
      lat === null ||
      lng === null ||
      lat === '' ||
      lng === ''
    ) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar latitud y longitud.'
      });
    }

    const latitud = Number(lat);
    const longitud = Number(lng);

    // Validar coordenadas
    if (
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud) ||
      latitud < -90 ||
      latitud > 90 ||
      longitud < -180 ||
      longitud > 180
    ) {
      return res.status(400).json({
        success: false,
        error: 'Las coordenadas proporcionadas son inválidas.'
      });
    }

    // Consultar el servicio de ubicaciones
    const ubicacion = await locationService.resolverUbicacion(
      latitud,
      longitud
    );

    return res.status(200).json({
      success: true,
      data: ubicacion
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { resolver };
