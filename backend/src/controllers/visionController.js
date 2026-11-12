'use strict';

const visionAnalysisService = require('../services/visionAnalysisService');

// Express 5 reenvía al errorHandler las promesas rechazadas de handlers async.

async function listarPorReporte(req, res) {
  const data = await visionAnalysisService.listarPorReporte(req.params.id, req.user);
  res.status(200).json({ data });
}

async function solicitar(req, res) {
  const data = await visionAnalysisService.solicitar(req.params.id, req.user, req.requestId);
  res.status(202).location(`/api/v1/analisis-vision/${data.id}`).json({ data });
}

async function obtener(req, res) {
  const data = await visionAnalysisService.obtener(req.params.id, req.user);
  res.status(200).json({ data });
}

module.exports = { listarPorReporte, solicitar, obtener };
