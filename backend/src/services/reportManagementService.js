const AppError = require('../middlewares/AppError');

let dependenciesPromise = null;

// Carga PostgreSQL y el repositorio ESM desde nuestra capa CommonJS.
async function getDependencies() {
  if (!dependenciesPromise) {
    dependenciesPromise = Promise.all([
      import('../config/database.js'),
      import('../repositories/reportRepository.js'),
    ])
      .then(([database, repository]) => ({
        pool: database.pool,
        repository,
      }))
      .catch((error) => {
        dependenciesPromise = null;
        throw error;
      });
  }

  return dependenciesPromise;
}

// Traduce errores del repositorio al formato HTTP del proyecto.
function translateRepositoryError(error) {
  switch (error?.name) {
    case 'RepositoryValidationError':
      return new AppError(
        400,
        'VALIDATION_ERROR',
        error.message,
        error.field
          ? [{ field: error.field, issue: error.message }]
          : []
      );

    case 'RepositoryForbiddenError':
      return new AppError(
        403,
        'FORBIDDEN',
        error.message
      );

    case 'MunicipalityCoverageError':
      return new AppError(
        422,
        'MUNICIPALIDAD_SIN_COBERTURA',
        error.message
      );

    case 'RepositoryNotFoundError':
      return new AppError(
        404,
        'NOT_FOUND',
        error.message
      );

    case 'RepositoryConflictError':
      return new AppError(
        409,
        'CONFLICT',
        error.message
      );

    default:
      return error;
  }
}

async function executeRepository(operation) {
  try {
    return await operation();
  } catch (error) {
    throw translateRepositoryError(error);
  }
}

// Obtiene el ámbito del funcionario autenticado.
function getActorScope(actor) {
  if (!actor || !actor.rol) {
    throw new AppError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Se requiere autenticación válida.'
    );
  }

  return {
    rol: actor.rol,
    municipalidad_id: actor.municipalidad_id,
  };
}

// Datos de auditoría para modificaciones administrativas.
function getAuditActor(actor) {
  if (!actor || !Number.isInteger(Number(actor.id))) {
    throw new AppError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Se requiere un funcionario autenticado.'
    );
  }

  return {
    tipo_actor: 'funcionario',
    actor_user_id: Number(actor.id),
  };
}

/**
 * GET /api/v1/reportes
 */
async function listReports(query = {}, actor) {
  return executeRepository(async () => {
    const { pool, repository } = await getDependencies();

    return repository.listReports(pool, {
      scope: getActorScope(actor),
      estado: query.estado || undefined,
      severidad: query.severidad || undefined,
      municipalidad_id:
        query.municipalidad_id || undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  });
}

/**
 * GET /api/v1/reportes/:id
 */
async function getReportById(id, actor) {
  return executeRepository(async () => {
    const { pool, repository } = await getDependencies();

    const report = await repository.getReportById(
      pool,
      id,
      getActorScope(actor)
    );

    if (!report) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Reporte no encontrado.'
      );
    }

    return report;
  });
}

/**
 * GET /api/v1/reportes/:id/foto
 * Devuelve los metadatos necesarios para recuperar la imagen
 * mediante el servicio de almacenamiento.
 */
async function getReportPhotoMetadata(id, actor) {
  return executeRepository(async () => {
    const { pool, repository } = await getDependencies();

    const metadata = await repository.getReportPhotoMetadata(
      pool,
      id,
      getActorScope(actor)
    );

    if (!metadata) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Fotografía no encontrada.'
      );
    }

    return metadata;
  });
}

/**
 * POST /api/v1/reportes
 * Preparado para utilizarse cuando el servicio ciudadano
 * entregue la ubicación resuelta y los metadatos de la foto.
 */
async function createReport(input, requestId) {
  return executeRepository(async () => {
    const { pool, repository } = await getDependencies();

    return repository.createReport(
      pool,
      input,
      {
        tipo_actor: 'invitado',
        actor_user_id: null,
        request_id: requestId ?? null,
      }
    );
  });
}

/**
 * PUT /api/v1/reportes/:id
 */
async function updateReport(id, updates, actor) {
  return executeRepository(async () => {
    const { pool, repository } = await getDependencies();

    const updated = await repository.updateReport(
      pool,
      id,
      updates,
      getActorScope(actor),
      getAuditActor(actor)
    );

    if (!updated) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Reporte no encontrado.'
      );
    }

    return updated;
  });
}

/**
 * PATCH /api/v1/reportes/:id/estado
 */
async function updateReportStatus(id, estado, actor) {
  return updateReport(
    id,
    { estado },
    actor
  );
}

/**
 * DELETE /api/v1/reportes/:id
 * Archivo lógico, no eliminación física.
 */
async function archiveReport(id, actor) {
  return executeRepository(async () => {
    const { pool, repository } = await getDependencies();

    const archived = await repository.archiveReport(
      pool,
      id,
      getActorScope(actor),
      getAuditActor(actor)
    );

    if (!archived) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Reporte no encontrado.'
      );
    }

    return archived;
  });
}

module.exports = {
  listReports,
  getReportById,
  getReportPhotoMetadata,
  createReport,
  updateReport,
  updateReportStatus,
  archiveReport,
};