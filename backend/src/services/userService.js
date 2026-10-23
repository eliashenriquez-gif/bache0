// TEMPORAL: simulación para poder probar el controller sin base de datos.
// Reemplazar por la implementación real (reglas de negocio + Repository).
// El service real debe lanzar AppError(409, 'CONFLICT', ...) si el email ya existe.

let nextId = 1;

async function createUser(userData) {
  const now = new Date().toISOString();
  return {
    id: nextId++,
    ...userData, // incluye password_hash a propósito: el controller NO debe devolverlo
    activo: true,
    created_at: now,
    updated_at: now,
  };
}

module.exports = { createUser };
