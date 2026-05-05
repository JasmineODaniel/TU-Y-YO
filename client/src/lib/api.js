/**
 * WhisperBox API Client
 * 
 * Centralized HTTP client for the WhisperBox REST API.
 * Tokens stored in memory only (not localStorage).
 */

const BASE_URL = 'https://whisperbox.koyeb.app';

let accessToken = null;
let refreshTokenValue = null;
let tokenExpiresAt = null;
let onTokenRefreshFailed = null;

export function setTokens(access, refresh, expiresIn) {
  accessToken = access;
  refreshTokenValue = refresh;
  tokenExpiresAt = Date.now() + (expiresIn * 1000) - 30000;
}

export function getAccessToken() { return accessToken; }
export function getRefreshToken() { return refreshTokenValue; }

export function clearTokens() {
  accessToken = null;
  refreshTokenValue = null;
  tokenExpiresAt = null;
}

export function setOnTokenRefreshFailed(callback) {
  onTokenRefreshFailed = callback;
}

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  if (accessToken && tokenExpiresAt && Date.now() > tokenExpiresAt && refreshTokenValue) {
    try { await doRefreshToken(); } catch { /* will get 401 below */ }
  }
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken && !options.noAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && refreshTokenValue && !options._isRetry) {
    try {
      await doRefreshToken();
      return apiFetch(path, { ...options, _isRetry: true });
    } catch {
      if (onTokenRefreshFailed) onTokenRefreshFailed();
      throw new Error('Session expired. Please log in again.');
    }
  }
  if (!response.ok) {
    let msg = `API Error: ${response.status}`;
    try {
      const d = await response.json();
      if (d.detail) msg = typeof d.detail === 'string' ? d.detail : Array.isArray(d.detail) ? d.detail.map(x => x.msg).join(', ') : msg;
    } catch {}
    throw new Error(msg);
  }
  return response.json();
}

export async function register(data) {
  const r = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data), noAuth: true });
  setTokens(r.access_token, r.refresh_token, r.expires_in);
  return r;
}

export async function login(username, password) {
  const r = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }), noAuth: true });
  setTokens(r.access_token, r.refresh_token, r.expires_in);
  return r;
}

export async function getMe() { return apiFetch('/auth/me'); }

async function doRefreshToken() {
  if (!refreshTokenValue) throw new Error('No refresh token');
  const r = await apiFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshTokenValue }), noAuth: true });
  accessToken = r.access_token;
  tokenExpiresAt = Date.now() + (r.expires_in * 1000) - 30000;
  return r;
}

export { doRefreshToken as refreshToken };

export async function logout() {
  if (!refreshTokenValue) return;
  try { await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshTokenValue }) }); } finally { clearTokens(); }
}

export async function searchUsers(query) {
  return apiFetch(`/users/search?q=${encodeURIComponent(query)}`);
}

export async function getUserPublicKey(userId) {
  return apiFetch(`/users/${userId}/public-key`);
}

export async function getConversations() {
  return apiFetch('/conversations');
}

export async function getMessages(userId, limit = 50, before = null) {
  let path = `/conversations/${userId}/messages?limit=${limit}`;
  if (before) path += `&before=${encodeURIComponent(before)}`;
  return apiFetch(path);
}

export async function sendMessage(to, payload) {
  return apiFetch('/messages', { method: 'POST', body: JSON.stringify({ to, payload }) });
}
