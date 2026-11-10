const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'bache0_access_token';

async function parseResponse(response) {
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
      payload?.message ||
      `Error HTTP ${response.status}`
    );

    error.status = response.status;
    error.code = payload?.error?.code;
    error.details = payload?.error?.details;

    throw error;
  }

  return payload?.data ?? payload;
}

export async function loginMunicipal(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  return parseResponse(response);
}

export async function getCurrentUser(token) {
  if (!token) {
    throw new Error('No hay una sesión autenticada.');
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseResponse(response);
}

export function saveAccessToken(token) {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

export function readAccessToken() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}