
const reporteService = require('../services/reportService');
const reportManagementService = require('../services/reportManagementService');
const AppError = require('../middlewares/AppError');

/**
 * GET /api/v1/reportes
 * Lista reportes según los permisos del usuario autenticado.
 */
async function obtenerReportes(req, res) {
  const result = await reportManagementService.listReports(
    req.query,
    req.user
  );

  return res.status(200).json(result);
}

/**
 * GET /api/v1/reportes/:id
 */
async function obtenerReporte(req, res) {
  const reporte = await reportManagementService.getReportById(
    req.params.id,
    req.user
  );

  return res.status(200).json({
    data: reporte
  });
}

/**
 * POST /api/v1/reportes
 * Recibe un reporte ciudadano con fotografía.
 */
async function crearReporte(req, res, next) {
  try {
    const { lat, lng, gravedad, descripcion } = req.body || {};
    const foto = req.file;

    const latitud = Number(lat);
    const longitud = Number(lng);

    if (
      lat === undefined ||
      lng === undefined ||
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud) ||
      latitud < -90 ||
      latitud > 90 ||
      longitud < -180 ||
      longitud > 180 ||
      !foto
    ) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios o las coordenadas son inválidas.'
      });
    }

    const datosContrato = {
      latitud,
      longitud,
      severidad: gravedad,
      descripcion
    };

    const nuevoReporte = await reporteService.procesarNuevoReporte(
      datosContrato,
      foto
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Reporte ingresado exitosamente',
      folio: nuevoReporte.folio,
      data: nuevoReporte
    });

  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/reportes/:id/foto
 * Pendiente de integración con el almacenamiento.
 */
async function obtenerFoto(req, res) {
  throw new AppError(
    503,
    'SERVICE_UNAVAILABLE',
    'La recuperación de fotografías todavía no está integrada.'
  );
}

/**
 * PUT /api/v1/reportes/:id
 */
async function actualizarReporte(req, res) {
  const reporte = await reportManagementService.updateReport(
    req.params.id,
    req.body,
    req.user
  );

  return res.status(200).json({
    data: reporte
  });
}

/**
 * PATCH /api/v1/reportes/:id/estado
 */
async function actualizarEstado(req, res) {
  if (
    !req.body ||
    typeof req.body.estado !== 'string' ||
    !req.body.estado.trim()
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Debe proporcionar un estado válido.',
      [{
        field: 'estado',
        issue: 'Es obligatorio.'
      }]
    );
  }

  const reporte = await reportManagementService.updateReportStatus(
    req.params.id,
    req.body.estado,
    req.user
  );

  return res.status(200).json({
    data: reporte
  });
}

/**
 * DELETE /api/v1/reportes/:id
 * Archivado lógico.
 */
async function archivarReporte(req, res) {
  await reportManagementService.archiveReport(
    req.params.id,
    req.user
  );

  return res.status(204).send();
}

module.exports = {
  obtenerReportes,
  obtenerReporte,
  crearReporte,
  obtenerFoto,
  actualizarReporte,
  actualizarEstado,
  archivarReporte
};
