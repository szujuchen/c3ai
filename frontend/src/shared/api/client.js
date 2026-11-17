import { getSession } from '../session.js';

// The one place that knows where the API lives. Override with VITE_API_BASE_URL when the API is on another origin.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; }
}

// Called when the server says the session is gone (expired, or the server restarted).
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function request(path, { method = 'GET', query, body } = {}) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => [k, v === true ? '1' : v])).toString() : '';
  const token = getSession()?.token;
  const res = await fetch(`${BASE_URL}${path}${qs ? '?' + qs : ''}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && path !== '/auth/login') onUnauthorized();
  if (!res.ok) throw new ApiError(data?.error?.message ?? `Request failed (${res.status})`, res.status);
  return data;
}
