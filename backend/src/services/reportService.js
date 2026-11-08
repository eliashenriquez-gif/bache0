const fs = require('node:fs/promises');
const AppError = require('../middlewares/AppError');
const { resolverUbicacion } = require('./locationService');
const management = require('./reportManagementService');
const storage = require('./photoStorageService');
function invalid(message) { throw new AppError(400, 'VALIDATION_ERROR', message); }
async function procesarNuevoReporte(datos, foto, requestId) {
  let key;
  try {
    if (!foto) invalid('La fotografía es obligatoria.');
    if (!datos || datos.latitud === '' || datos.longitud === '' || datos.latitud == null || datos.longitud == null) invalid('Faltan coordenadas.');
    if (datos.ubicacion_confirmada !== 'true' && datos.ubicacion_confirmada !== true) invalid('Debes confirmar la ubicación.');
    if (!['gps','pin_manual'].includes(datos.metodo_ubicacion)) invalid('Método de ubicación inválido.');
    if (!['baja','media','alta'].includes(datos.severidad)) invalid('Severidad inválida.');
    if (!['baja','media','alta','muy_alta'].includes(datos.concurrencia_vial)) invalid('Concurrencia vial inválida.');
    if (!['ninguna','colegio','centro_salud','estacion_terminal','otra'].includes(datos.infraestructura_critica)) invalid('Infraestructura crítica inválida.');
    if (String(datos.descripcion || '').length > 2000) invalid('La descripción supera los 2000 caracteres.');
    const latitud = Number(datos.latitud), longitud = Number(datos.longitud);
    const precision = datos.precision_ubicacion_m == null || datos.precision_ubicacion_m === '' ? null : Number(datos.precision_ubicacion_m);
    const location = await resolverUbicacion(latitud, longitud, datos.metodo_ubicacion, precision);
    const photo = await storage.savePhoto(foto); key = photo.foto_storage_key;
    const created = await management.createReport({
      latitud, longitud, precision_ubicacion_m: precision, metodo_ubicacion: datos.metodo_ubicacion,
      ubicacion_confirmada: true, municipalidad_id: location.municipalidad.id,
      direccion_detectada: location.direccion_detectada, calle_detectada: location.calle_detectada,
      comuna_detectada: location.comuna_detectada, region_detectada: location.region_detectada,
      estado_geocodificacion: location.estado_resolucion, geocodificacion_proveedor: 'nominatim',
      clasificacion_vial: null, clasificacion_vial_estado: 'pendiente',
      severidad: datos.severidad, concurrencia_vial: datos.concurrencia_vial,
      infraestructura_critica: datos.infraestructura_critica, descripcion: datos.descripcion || null,
      ...photo,
    }, requestId);
    return created;
  } catch (error) {
    if (key) await storage.deletePhoto(key).catch(() => {});
    throw error;
  } finally {
    if (foto?.path) await fs.rm(foto.path, { force: true }).catch(() => {});
  }
}
module.exports = { procesarNuevoReporte };
