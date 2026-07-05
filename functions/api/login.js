import { parseBody, createSession, setSessionCookie, successResponse, errorResponse, handleOptions, verifyPassword } from './_auth.js';
export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);
  const { username, password } = await parseBody(request);
  if (!username || !password) return errorResponse('Username and password required', 400);
  const user = await env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first();
  if (!user) return errorResponse('Invalid credentials', 401);
  if (!(await verifyPassword(password, user.password_hash))) return errorResponse('Invalid credentials', 401);
  const session = await createSession(env, user.id);
  const resp = successResponse({ success: true, admin: { username: user.username, display_name: user.display_name } });
  resp.headers.append('Set-Cookie', setSessionCookie(session.token));
  return resp;
}
