
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

function buildHeaders(token, extraHeaders = {}) {
  if (!token) {
    throw new Error('Se requiere un token de autenticación.');
  }

  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Error HTTP ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.error?.code;
    error.details = payload?.error?.details;

    throw error;
  }

  return payload;
}

/**
 * GET /api/v1/reportes
 * El backend aplica automáticamente el ámbito municipal del JWT.
 */
export async function listReports({
  token,
  estado,
  severidad,
  municipalidad_id,
  page = 1,
  limit = 20,
} = {}) {
  const params = new URLSearchParams();

  if (estado) params.set('estado', estado);
  if (severidad) params.set('severidad', severidad);

  // Este filtro solo corresponde al superadministrador.
  if (municipalidad_id !== undefined) {
    params.set('municipalidad_id', String(municipalidad_id));
  }

  params.set('page', String(page));
  params.set('limit', String(limit));

  const response = await fetch(
    `${API_BASE_URL}/api/v1/reportes?${params.toString()}`,
    {
      method: 'GET',
      headers: buildHeaders(token),
    }
  );

  return parseResponse(response);
}

/**
 * GET /api/v1/reportes/:id
 */
export async function getReport(token, id) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/reportes/${encodeURIComponent(id)}`,
    {
      headers: buildHeaders(token),
    }
  );

  const payload = await parseResponse(response);
  return payload?.data ?? payload;
}

/**
 * GET /api/v1/reportes/:id/foto
 * Devuelve un Blob para mostrar la fotografía sin exponer rutas físicas.
 */
export async function getReportPhoto(token, id) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/reportes/${encodeURIComponent(id)}/foto`,
    {
      headers: buildHeaders(token),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error?.message || `No se pudo obtener la fotografía (HTTP ${response.status}).`
    );
  }

  return response.blob();
}

/**
 * PUT /api/v1/reportes/:id
 * Actualización general para administrador municipal o superadministrador.
 */
export async function updateReport(token, id, changes) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/reportes/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: buildHeaders(token, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(changes),
    }
  );

  const payload = await parseResponse(response);
  return payload?.data ?? payload;
}

/**
 * PATCH /api/v1/reportes/:id/estado
 * Cambio de estado permitido para inspector, administrador y superadministrador.
 */
export async function updateReportStatus(token, id, estado) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/reportes/${encodeURIComponent(id)}/estado`,
    {
      method: 'PATCH',
      headers: buildHeaders(token, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ estado }),
    }
  );

  const payload = await parseResponse(response);
  return payload?.data ?? payload;
}

/**
 * DELETE /api/v1/reportes/:id
 * Archivo lógico; no elimina físicamente el reporte.
 */
export async function archiveReport(token, id) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/reportes/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: buildHeaders(token),
    }
  );

  return parseResponse(response);
}
