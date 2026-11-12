'use strict';

const fs = require('node:fs/promises');
const AppError = require('../middlewares/AppError');
const { resolverUbicacion } = require('./locationService');
const management = require('./reportManagementService');
const storage = require('./photoStorageService');
const visionService = require('./visionService');
const { calcularPrioridad, PriorityInputError } = require('./priorityService');

function invalid(message) { throw new AppError(400, 'VALIDATION_ERROR', message); }

let persistenciaPromise = null;
function cargarPersistenciaReal() {
  if (!persistenciaPromise) {
    persistenciaPromise = Promise.all([
      import('../config/database.js'),
      import('../repositories/reportRepository.js'),
      import('../repositories/visionAnalysisRepository.js'),
    ]).then(([database, reportes, vision]) => ({ pool: database.pool, reportes, vision }))
      .catch((error) => { persistenciaPromise = null; throw error; });
  }
  return persistenciaPromise;
}

const actorSistema = (requestId = null) => ({ tipo_actor: 'sistema', actor_user_id: null, request_id: requestId });
const scopeDeSistema = (reporte) => ({ rol: 'administrador_municipal', municipalidad_id: reporte.municipalidad_id });

function calcularPrioridadProvisional(datos) {
  try {
    return calcularPrioridad({
        severidad: datos?.severidad,
        concurrencia_vial: datos?.concurrencia_vial,
        infraestructura_critica: datos?.infraestructura_critica,
        // Clasificación vial dejada fuera de alcance intencionalmente
        clasificacion_vial: null,
        clasificacion_vial_estado: 'pendiente',
        clasificacion_vial_fuente: null,
      }, null);
  } catch (error) {
    return null;
  }
}

function construirPrioridadParaGuardar(resultado) {
  return {
    prioridad: resultado.prioridad,
    version_reglas: resultado.version_reglas,
    motivos: [
      { tipo: 'resumen', puntaje: resultado.puntaje, provisional: resultado.provisional, rango_posible: resultado.rango_posible },
      ...resultado.antecedentes.map((antecedente) => ({ tipo: 'antecedente', ...antecedente })),
      ...resultado.motivos.map((texto) => ({ tipo: 'motivo', texto })),
      ...resultado.datos_no_disponibles.map((factor) => ({ tipo: 'dato_no_disponible', factor })),
      ...resultado.advertencias.map((texto) => ({ tipo: 'advertencia', texto })),
    ],
  };
}

async function persistirPrioridad(reporte, resultado, persistencia, requestId) {
  await persistencia.reportes.updateReportPriority(
    persistencia.pool, reporte.id, construirPrioridadParaGuardar(resultado),
    scopeDeSistema(reporte), actorSistema(requestId)
  );
}

async function guardarPrioridadProvisional(creado, datos, requestId) {
  try {
    const resultado = calcularPrioridadProvisional(datos);
    if (resultado) await persistirPrioridad(creado, resultado, await cargarPersistenciaReal(), requestId);
  } catch (error) { }
}

async function recalcularPrioridad(reporte, analisisParaMotor, persistencia, requestId) {
  try {
    const resultado = calcularPrioridad(reporte, analisisParaMotor);
    await persistirPrioridad(reporte, resultado, persistencia, requestId);
    return resultado;
  } catch (error) { return null; }
}

async function ejecutarAnalisisVision(reporte, rutaFoto, { analisisId = null, requestId = null } = {}) {
  try {
    if (analisisId == null && !visionService.visionHabilitada()) return;

    const persistencia = await cargarPersistenciaReal();
    const contexto = { scope: scopeDeSistema(reporte), actor: actorSistema(requestId) };

    let id = analisisId;
    if (id == null) {
      const fila = await persistencia.vision.createVisionAnalysis(
        persistencia.pool, { reporte_id: reporte.id, estado: 'pendiente', detecciones: [] }, contexto
      );
      id = fila.id;
    }

    const r = await visionService.analyzeImage(rutaFoto);

    if (!r.ok) {
      await persistencia.vision.updateVisionAnalysis(
        persistencia.pool, id, { estado: 'fallido', error_code: r.error_code }, contexto
      );
      return;
    }

    const { analisis } = r;
    const detecciones = Array.isArray(analisis.detecciones) && analisis.detecciones.length > 0
      ? analisis.detecciones
      : [{ etiqueta: analisis.tipo_desperfecto, confianza: analisis.confianza, caja: null, severidad_sugerida: analisis.severidad_sugerida ?? null }];
    
    await persistencia.vision.updateVisionAnalysis(
      persistencia.pool, id,
      { estado: 'completado', proveedor: analisis.proveedor, modelo: analisis.modelo, version_modelo: analisis.version_modelo ?? null, detecciones, error_code: null, analizado_at: new Date().toISOString() },
      contexto
    );

    await recalcularPrioridad(reporte, { estado: 'completado', proveedor: analisis.proveedor, modelo: analisis.modelo, detecciones }, persistencia, requestId);
  } catch (error) { }
}

const pendientes = new Set();

function iniciarAnalisisVision(reporte, storageKey, requestId, { analisisId = null } = {}) {
  try {
    const rutaFoto = storage.resolvePhotoPath(storageKey);
    const tarea = ejecutarAnalisisVision(reporte, rutaFoto, { requestId, analisisId })
      .finally(() => pendientes.delete(tarea));
    pendientes.add(tarea);
  } catch (error) {}
}

async function procesarNuevoReporte(datos, foto, requestId) {
  let key;
  try {
    if (!foto) invalid('La fotografía es obligatoria.');
    if (!datos || datos.latitud === '' || datos.longitud === '') invalid('Faltan coordenadas.');
    if (datos.ubicacion_confirmada !== 'true' && datos.ubicacion_confirmada !== true) invalid('Debes confirmar la ubicación.');
    
    const latitud = Number(datos.latitud), longitud = Number(datos.longitud);
    const precision = datos.precision_ubicacion_m == null || datos.precision_ubicacion_m === '' ? null : Number(datos.precision_ubicacion_m);
    const location = await resolverUbicacion(latitud, longitud, datos.metodo_ubicacion, precision);
    
    const photo = await storage.savePhoto(foto); 
    key = photo.foto_storage_key;
    
    const created = await management.createReport({
      latitud, longitud, precision_ubicacion_m: precision, metodo_ubicacion: datos.metodo_ubicacion,
      ubicacion_confirmada: true, municipalidad_id: location.municipalidad.id,
      direccion_detectada: location.direccion_detectada, calle_detectada: location.calle_detectada,
      comuna_detectada: location.comuna_detectada, region_detectada: location.region_detectada,
      estado_geocodificacion: location.estado_resolucion, geocodificacion_proveedor: 'nominatim',
      // Forzando clasificación vial fuera de alcance:
      clasificacion_vial: null,
      clasificacion_vial_estado: 'pendiente',
      clasificacion_vial_fuente: null,
      clasificacion_vial_verificada_at: null,
      severidad: datos.severidad, concurrencia_vial: datos.concurrencia_vial,
      infraestructura_critica: datos.infraestructura_critica, descripcion: datos.descripcion || null,
      ...photo,
    }, requestId);

    await guardarPrioridadProvisional(created, datos, requestId);
    iniciarAnalisisVision(created, key, requestId);

    return created;
  } catch (error) {
    if (key) await storage.deletePhoto(key).catch(() => {});
    throw error;
  } finally {
    if (foto?.path) await fs.rm(foto.path, { force: true }).catch(() => {});
  }
}

module.exports = {
  procesarNuevoReporte, ejecutarAnalisisVision, iniciarAnalisisVision, recalcularPrioridad,
  calcularPrioridadProvisional, construirPrioridadParaGuardar
};