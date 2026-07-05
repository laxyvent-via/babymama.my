// Lamda Auth Utilities — shared by all API handlers
const SESSION_COOKIE = 'lamda_session';
const SESSION_MAX = 86400 * 7;

export function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function validateSession(env, token) {
  if (!token) return null;
  const s = await env.DB.prepare(
    `SELECT s.id, s.admin_user_id, s.expires_at, a.username, a.display_name, a.role
     FROM sessions s JOIN admin_users a ON a.id = s.admin_user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
  return s ? { id: s.admin_user_id, username: s.username, display_name: s.display_name, role: s.role } : null;
}

export async function createSession(env, uid) {
  const token = generateToken();
  const exp = new Date(Date.now() + SESSION_MAX * 1000).toISOString().replace('T', ' ').replace('Z', '');
  await env.DB.prepare('INSERT INTO sessions (token, admin_user_id, expires_at) VALUES (?, ?, ?)').bind(token, uid, exp).run();
  return { token, exp };
}

export async function destroySession(env, token) {
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export async function requireAdmin(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const cookies = {};
  cookie.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k && v.length) cookies[k.trim()] = decodeURIComponent(v.join('=')); });
  const token = cookies[SESSION_COOKIE];
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: hdrs() });
  const admin = await validateSession(env, token);
  if (!admin) return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401, headers: hdrs() });
  return admin;
}

export function setSessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function parseBody(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return await request.json();
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) return await request.formData();
  return {};
}

export async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  if (hash.startsWith('sha256:')) {
    const expected = hash.slice('sha256:'.length).toLowerCase();
    const enc = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    const actual = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    return actual === expected;
  }
  return password === hash;
}

function hdrs() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true'
  };
}

export function handleOptions() { return new Response(null, { status: 204, headers: hdrs() }); }

export function successResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: hdrs() });
}

export function errorResponse(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: hdrs() });
}
