'use strict';

const reportService = require('../services/reportService');
const AppError = require('../middlewares/AppError');

/**
 * POST /api/v1/reportes
 * Recibe un reporte ciudadano (multipart/form-data, campo "foto").
 */
async function crearReporte(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'La fotografía es obligatoria.', [
        { field: 'foto', issue: 'Es obligatoria.' },
      ]);
    }

    const data = await reportService.crearReporte(req.body || {}, req.file);
    return res.status(201).json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = { crearReporte };