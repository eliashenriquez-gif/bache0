/** Errores de dominio de la capa de persistencia. El Service/API los traduce a HTTP. */
export class RepositoryValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'RepositoryValidationError';
    this.code = 'VALIDATION_ERROR';
    this.field = field;
  }
}

export class RepositoryForbiddenError extends Error {
  constructor(message = 'No existe un ámbito municipal autorizado para esta operación.') {
    super(message);
    this.name = 'RepositoryForbiddenError';
    this.code = 'FORBIDDEN';
  }
}

export class MunicipalityCoverageError extends Error {
  constructor(message = 'La municipalidad no está activa o no tiene Bache 0 habilitado.') {
    super(message);
    this.name = 'MunicipalityCoverageError';
    this.code = 'MUNICIPALIDAD_SIN_COBERTURA';
  }
}

export class RepositoryNotFoundError extends Error {
  constructor(message = 'El recurso solicitado no existe o no está disponible para el solicitante.') {
    super(message);
    this.name = 'RepositoryNotFoundError';
    this.code = 'NOT_FOUND';
  }
}

export class RepositoryConflictError extends Error {
  constructor(message = 'La operación entra en conflicto con el estado actual del recurso.') {
    super(message);
    this.name = 'RepositoryConflictError';
    this.code = 'CONFLICT';
  }
}
