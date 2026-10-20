import { RepositoryValidationError } from './repositoryErrors.js';

const AUDIT_ACTOR_TYPES = new Set(['funcionario', 'invitado', 'sistema']);
const AUDIT_ENTITIES = new Set(['municipalidades', 'usuarios', 'reportes', 'analisis_vision']);

/**
 * Registra un evento de auditoría en la MISMA transacción de la mutación principal.
 * No guardar contraseñas, hashes, JWT, claves, imágenes ni rutas físicas dentro de cambios.
 * `client` debe ser un cliente PostgreSQL adquirido mediante pool.connect().
 */
export async function insertAuditEvent(client, event) {
  if (!event || !AUDIT_ACTOR_TYPES.has(event.tipo_actor)) {
    throw new RepositoryValidationError('tipo_actor de auditoría no válido.', 'tipo_actor');
  }
  if (!AUDIT_ENTITIES.has(event.entidad)) {
    throw new RepositoryValidationError('Entidad de auditoría no válida.', 'entidad');
  }
  if (!Number.isInteger(Number(event.entidad_id)) || Number(event.entidad_id) < 1) {
    throw new RepositoryValidationError('entidad_id debe ser un entero positivo.', 'entidad_id');
  }
  if (!String(event.accion ?? '').trim()) {
    throw new RepositoryValidationError('La acción de auditoría es obligatoria.', 'accion');
  }
  if (event.tipo_actor === 'funcionario' && (!Number.isInteger(Number(event.actor_user_id)) || Number(event.actor_user_id) < 1)) {
    throw new RepositoryValidationError('Una acción de funcionario debe incluir actor_user_id.', 'actor_user_id');
  }
  if (event.tipo_actor !== 'funcionario' && event.actor_user_id != null) {
    throw new RepositoryValidationError('Un actor invitado/sistema no debe incluir actor_user_id.', 'actor_user_id');
  }
  const cambios = event.cambios ?? {};
  if (!cambios || Array.isArray(cambios) || typeof cambios !== 'object') {
    throw new RepositoryValidationError('cambios debe ser un objeto JSON.', 'cambios');
  }

  const result = await client.query(
    `INSERT INTO auditoria_eventos
       (actor_user_id, tipo_actor, entidad, entidad_id, accion, cambios, request_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id, created_at`,
    [
      event.actor_user_id ?? null,
      event.tipo_actor,
      event.entidad,
      Number(event.entidad_id),
      String(event.accion).trim(),
      JSON.stringify(cambios),
      event.request_id ?? null,
    ],
  );

  return result.rows[0];
}
