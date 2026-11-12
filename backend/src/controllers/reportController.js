
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
    const data = await reporteService.procesarNuevoReporte(req.body || {}, req.file, req.requestId);
    if (data?.id != null) res.location(`/api/v1/reportes/${data.id}`);
    return res.status(201).json({ data });
  } catch (error) { return next(error); }
}

/** GET /api/v1/reportes/:id/foto: acceso restringido por ámbito municipal. */
async function obtenerFoto(req, res) {
  const storage = require('../services/photoStorageService');
  const metadata = await reportManagementService.getReportPhotoMetadata(req.params.id, req.user);
  const bytes = await storage.readPhoto(metadata.storage_key);
  res.set('Content-Type', metadata.mime_type);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(bytes);
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
