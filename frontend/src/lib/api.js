// src/lib/api.js
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || '').replace(/\/+$/, '');

export async function api(path, { method = 'GET', body, token } = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep text */ }

  if (!res.ok) {
    const msg = data?.message || data?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
