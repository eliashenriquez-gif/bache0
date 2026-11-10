'use strict';

const fs = require('node:fs/promises');
const AppError = require('../middlewares/AppError');
const { resolverUbicacion } = require('./locationService');
const management = require('./reportManagementService');
const storage = require('./photoStorageService');
const visionService = require('./visionService');
const { calcularPrioridad, PriorityInputError } = require('./priorityService');

/*
 * ─────────────────────────── DEPENDENCIAS CON LA CAPA DE DATOS ───────────────────────────
 *  reportRepository.updateReportPriority(pool, id, { prioridad, motivos[], version_reglas }, scope, actor)
 *      (existente) → persiste la prioridad y su explicación estructurada.
 *  visionAnalysisRepository.createVisionAnalysis(pool, input, { scope, actor })
 *      (existente) → crea la fila de analisis_vision.
 *  visionAnalysisRepository.updateVisionAnalysis(pool, id, cambios, { scope, actor })
 *      (NUEVO, entregado como parche para que Elías lo revise) → pasa la fila a completado | fallido.
 *  photoStorageService.resolvePhotoPath(key)
 *      (NUEVO, parche de 3 líneas) → ruta de la foto ya guardada, para analizarla con Gemini.
 *
 * Los procesos automáticos actúan como `sistema` con un ámbito sintético limitado a la
 * municipalidad del propio reporte (administrador_municipal), nunca como superadministrador.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

function invalid(message) { throw new AppError(400, 'VALIDATION_ERROR', message); }

// ───────────────────────────── Persistencia (repositorios ESM) ─────────────────────────────
let persistenciaPromise = null;
function cargarPersistenciaReal() {
  if (!persistenciaPromise) {
    persistenciaPromise = Promise.all([
      import('../config/database.js'),
      import('../repositories/reportRepository.js'),
      import('../repositories/visionAnalysisRepository.js'),
    ])
      .then(([database, reportes, vision]) => ({ pool: database.pool, reportes, vision }))
      .catch((error) => {
        persistenciaPromise = null;
        throw error;
      });
  }
  return persistenciaPromise;
}
let cargarPersistencia = cargarPersistenciaReal;

const actorSistema = (requestId = null) => ({ tipo_actor: 'sistema', actor_user_id: null, request_id: requestId });
const scopeDeSistema = (reporte) => ({ rol: 'administrador_municipal', municipalidad_id: reporte.municipalidad_id });

// ───────────────────────────── Prioridad ─────────────────────────────
/**
 * Prioridad provisional: solo con los datos del ciudadano (sin tipo de vía confirmado
 * y sin análisis de imagen). Devuelve el resultado completo del motor o null si este falla.
 */
function calcularPrioridadProvisional(datos) {
  try {
    return calcularPrioridad(
      {
        severidad: datos?.severidad,
        concurrencia_vial: datos?.concurrencia_vial,
        infraestructura_critica: datos?.infraestructura_critica,
        clasificacion_vial: null,
        clasificacion_vial_estado: 'pendiente',
      },
      null
    );
  } catch (error) {
    const causa = error instanceof PriorityInputError ? 'datos de entrada inválidos' : 'error inesperado';
    console.error(`[ReportService] Prioridad provisional no calculada (${causa}): ${error.message}`);
    return null;
  }
}

/**
 * Adapta el resultado del motor al formato de reportes.prioridad / motivos / version_reglas.
 * `motivos` debe ser un arreglo de OBJETOS; no incluye la hora de cálculo para que
 * recalcular con los mismos datos no genere escrituras ni auditoría innecesarias.
 */
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
  const actualizado = await persistencia.reportes.updateReportPriority(
    persistencia.pool,
    reporte.id,
    construirPrioridadParaGuardar(resultado),
    scopeDeSistema(reporte),
    actorSistema(requestId)
  );
  if (actualizado === null) throw new Error('el reporte no está disponible en el ámbito del sistema');
  console.info(
    `[ReportService] Reporte ${reporte.id}: prioridad ${resultado.prioridad} ` +
    `(${resultado.puntaje} pts, provisional=${resultado.provisional}, reglas ${resultado.version_reglas})`
  );
}

/** Al crear: guarda la prioridad provisional. Nunca lanza; si falla, el reporte queda con prioridad null. */
async function guardarPrioridadProvisional(creado, datos, requestId) {
  try {
    const resultado = calcularPrioridadProvisional(datos);
    if (!resultado) return;
    await persistirPrioridad(creado, resultado, await cargarPersistencia(), requestId);
  } catch (error) {
    console.error(`[ReportService] No se pudo guardar la prioridad provisional del reporte ${creado?.id}: ${error.message}`);
  }
}

/** Con el análisis ya persistido, recalcula y actualiza la prioridad. Nunca lanza. */
async function recalcularPrioridad(reporte, analisisParaMotor, persistencia, requestId) {
  try {
    const resultado = calcularPrioridad(reporte, analisisParaMotor);
    await persistirPrioridad(reporte, resultado, persistencia, requestId);
    return resultado;
  } catch (error) {
    console.error(`[ReportService] No se pudo recalcular la prioridad del reporte ${reporte.id}: ${error.message}`);
    return null;
  }
}

// ───────────────────────────── Análisis de imagen (proceso secundario) ─────────────────────────────
/**
 * La base de datos actúa como cola:
 *   1. crea la fila `pendiente` ANTES de llamar a Gemini (si el servidor cae, queda rastro);
 *   2. llama a visionService.analyzeImage;
 *   3. actualiza esa misma fila a `completado` o `fallido`, y recalcula la prioridad.
 * Nunca lanza: lo que ocurra aquí no puede afectar a un reporte ya guardado.
 *
 * @param {object} reporte Reporte público ya creado (id, municipalidad_id, severidad, ...).
 * @param {string} rutaFoto Ruta de la foto persistida.
 * @param {{analisisId?: number, requestId?: string}} [opciones]
 *        `analisisId`: reutiliza una fila existente (reproceso desde un worker) en vez de crear otra.
 */
async function ejecutarAnalisisVision(reporte, rutaFoto, { analisisId = null, requestId = null } = {}) {
  try {
    const persistencia = await cargarPersistencia();
    const contexto = { scope: scopeDeSistema(reporte), actor: actorSistema(requestId) };

    // 1. Registro inicial en la cola
    let id = analisisId;
    if (id == null) {
      const fila = await persistencia.vision.createVisionAnalysis(
        persistencia.pool,
        { reporte_id: reporte.id, estado: 'pendiente', detecciones: [] },
        contexto
      );
      id = fila.id;
    }

    // 2. Llamada a Gemini
    const r = await visionService.analyzeImage(rutaFoto);

    // 3a. Falla: se actualiza la misma fila para poder reprocesarla
    if (!r.ok) {
      console.error(`[ReportService] Análisis del reporte ${reporte.id} no disponible: ${r.error_code} - ${r.mensaje}`);
      if (r.error_code === 'VISION_DESHABILITADA') return; // la fila queda `pendiente`: no es un fallo
      await persistencia.vision.updateVisionAnalysis(
        persistencia.pool,
        id,
        { estado: 'fallido', error_code: r.error_code },
        contexto
      );
      return;
    }

    // 3b. Éxito
    const { analisis } = r;
    const detecciones = [
      {
        etiqueta: analisis.tipo_desperfecto,
        confianza: analisis.confianza,
        caja: null,
        severidad_sugerida: analisis.severidad_sugerida,
      },
    ];
    await persistencia.vision.updateVisionAnalysis(
      persistencia.pool,
      id,
      {
        estado: 'completado',
        proveedor: analisis.proveedor,
        modelo: analisis.modelo,
        version_modelo: null,
        detecciones,
        error_code: null,
        analizado_at: new Date().toISOString(),
      },
      contexto
    );

    // 4. Con IA disponible la prioridad puede dejar de ser provisional.
    await recalcularPrioridad(
      reporte,
      { estado: 'completado', proveedor: analisis.proveedor, modelo: analisis.modelo, detecciones },
      persistencia,
      requestId
    );
  } catch (error) {
    console.error(`[ReportService] Falló el análisis del reporte ${reporte?.id}: ${error.message}`);
  }
}

// Seguimiento de tareas en segundo plano (pruebas y apagado ordenado).
const pendientes = new Set();

function iniciarAnalisisVision(reporte, storageKey, requestId) {
  try {
    if (typeof storage.resolvePhotoPath !== 'function') {
      throw new Error('photoStorageService.resolvePhotoPath no está disponible');
    }
    const rutaFoto = storage.resolvePhotoPath(storageKey);
    const tarea = ejecutarAnalisisVision(reporte, rutaFoto, { requestId })
      .catch((error) => console.error(`[ReportService] Error no controlado en visión: ${error.message}`))
      .finally(() => pendientes.delete(tarea));
    pendientes.add(tarea);
  } catch (error) {
    console.error(`[ReportService] No se pudo iniciar el análisis del reporte ${reporte?.id}: ${error.message}`);
  }
}

function esperarAnalisisPendientes() {
  return Promise.allSettled([...pendientes]);
}

// ───────────────────────────── Creación del reporte ─────────────────────────────
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

    // El reporte ya está guardado: desde aquí nada puede hacerlo fallar.
    await guardarPrioridadProvisional(created, datos, requestId);
    iniciarAnalisisVision(created, key, requestId); // fire-and-forget

    return created;
  } catch (error) {
    if (key) await storage.deletePhoto(key).catch(() => {});
    throw error;
  } finally {
    if (foto?.path) await fs.rm(foto.path, { force: true }).catch(() => {});
  }
}

module.exports = {
  procesarNuevoReporte,
  // Reutilizables por el futuro worker de reproceso y por las pruebas:
  ejecutarAnalisisVision,
  recalcularPrioridad,
  calcularPrioridadProvisional,
  construirPrioridadParaGuardar,
  esperarAnalisisPendientes,
  _setPersistenciaParaPruebas(fn) { cargarPersistencia = fn ?? cargarPersistenciaReal; },
};
