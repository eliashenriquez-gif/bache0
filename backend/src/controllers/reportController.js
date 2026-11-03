const reportService = require('../services/reportManagementService');
const AppError = require('../middlewares/AppError');

/**
 * GET /api/v1/reportes
 * Lista reportes dentro del ámbito autorizado por el JWT.
 */
async function obtenerReportes(req, res) {
  const result = await reportService.listReports(
    req.query,
    req.user
  );

  res.status(200).json(result);
}

/**
 * GET /api/v1/reportes/:id
 */
async function obtenerReporte(req, res) {
  const reporte = await reportService.getReportById(
    req.params.id,
    req.user
  );

  res.status(200).json({
    data: reporte
  });
}

/**
 * POST /api/v1/reportes
 * Pendiente de integración con el flujo ciudadano,
 * geocodificación y almacenamiento de fotografías.
 */
async function crearReporte(req, res) {
  throw new AppError(
    503,
    'SERVICE_UNAVAILABLE',
    'La creación de reportes ciudadanos todavía no está integrada.'
  );
}

/**
 * GET /api/v1/reportes/:id/foto
 * Pendiente de integración con StorageService.
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
 * Actualización administrativa.
 */
async function actualizarReporte(req, res) {
  const reporte = await reportService.updateReport(
    req.params.id,
    req.body,
    req.user
  );

  res.status(200).json({
    data: reporte
  });
}

/**
 * PATCH /api/v1/reportes/:id/estado
 * Inspector, administrador municipal o superadministrador.
 */
async function actualizarEstado(req, res) {
  if (
    !req.body ||
    typeof req.body.estado !== 'string'
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

  const reporte = await reportService.updateReportStatus(
    req.params.id,
    req.body.estado,
    req.user
  );

  res.status(200).json({
    data: reporte
  });
}

/**
 * DELETE /api/v1/reportes/:id
 * Archivo lógico, sin eliminación física.
 */
async function archivarReporte(req, res) {
  await reportService.archiveReport(
    req.params.id,
    req.user
  );

  res.status(204).send();
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