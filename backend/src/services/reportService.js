'use strict';

const visionService = require('./visionService');

// ───────── SIMULADO: reemplazar por los repositorios reales de Elías ─────────
const reportRepository = {
  async create(datos) {
    const id = Date.now();
    return { id, folio: `B0-${id}`, estado: 'pendiente', ...datos };
  },
};

const analisisVisionRepository = {
  async create(datos) {
    console.log('[SIMULADO] INSERT analisis_vision:', JSON.stringify(datos));
    return { id: Date.now(), ...datos };
  },
};
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proceso secundario: analiza la foto y registra el resultado.
 * Está aislado para que nada de lo que ocurra aquí afecte al reporte ya guardado.
 */
async function ejecutarAnalisisVision(reporte, rutaFoto) {
  try {
    const analisis = await visionService.analyzeImage(rutaFoto);

    if (!analisis) {
      await analisisVisionRepository.create({
        reporte_id: reporte.id,
        estado: 'fallido',
        error_code: 'VISION_NO_DISPONIBLE',
        detecciones: [],
      });
      return;
    }

    await analisisVisionRepository.create({
      reporte_id: reporte.id,
      proveedor: analisis.proveedor,
      modelo: analisis.modelo,
      version_modelo: null,
      estado: 'completado',
      detecciones: [
        {
          etiqueta: analisis.tipo_desperfecto,
          confianza: analisis.confianza,
          caja: null,
          severidad_sugerida: analisis.severidad_sugerida,
        },
      ],
      error_code: null,
      analizado_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[ReportService] Falló el análisis del reporte ${reporte.id}: ${error.message}`);
  }
}

/**
 * Crea un reporte ciudadano.
 * @param {object} datosCiudadano Campos validados del formulario.
 * @param {{path: string}} fileData Foto YA GUARDADA de forma persistente
 *        (no el temporal de Multer, que se borra al terminar la solicitud).
 */
async function crearReporte(datosCiudadano, fileData) {
  // 1. El reporte se guarda primero. Si esto falla, el error llega al controlador.
  const reporte = await reportRepository.create(datosCiudadano);

  // 2. Fire-and-forget: sin await, así la IA no retrasa ni puede tumbar la respuesta.
  ejecutarAnalisisVision(reporte, fileData.path).catch((error) => {
    console.error(`[ReportService] Error no controlado en visión: ${error.message}`);
  });

  // 3. Respuesta inmediata al ciudadano.
  return reporte;
}

module.exports = { crearReporte };