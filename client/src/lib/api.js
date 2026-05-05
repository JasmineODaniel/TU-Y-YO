/**
 * WhisperBox API Client
 * 
 * Centralized HTTP client for the WhisperBox REST API.
 * Tokens stored in memory only (not localStorage).
 */

const BASE_URL = 'http://localhost:5000';

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
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken && !options.noAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const response = await fetch(url, { ...options, headers });
  
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

export async function refreshToken() {
  // Simplified for now since we're using a local dev server
  return { access_token: accessToken };
}

export async function logout() {
  clearTokens();
}

export async function searchUsers(query) {
  return apiFetch(`/users/search?q=${encodeURIComponent(query)}`);
}

export async function getUserPublicKey(userId) {
  return apiFetch(`/users/${userId}/public-key`);
}

export async function updateProfilePic(profilePic) {
  return apiFetch('/users/profile-pic', { method: 'POST', body: JSON.stringify({ profilePic }) });
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
