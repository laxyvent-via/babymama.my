// GET /api/lamda-settings — public
// PUT /api/lamda-settings — admin
import { requireAdmin, parseBody, successResponse, errorResponse, handleOptions } from './_auth.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT key, value FROM lamda_settings').all();
    const s = {};
    for (const r of results) s[r.key] = r.value;
    if (!s.whatsapp_number) s.whatsapp_number = '60123456789';
    return successResponse(s);
  }

  if (request.method === 'PUT') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await parseBody(request);
    for (const [k, v] of Object.entries(body)) {
      await env.DB.prepare("INSERT INTO lamda_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')")
        .bind(k, String(v ?? '')).run();
    }
    return successResponse({ success: true });
  }

  return errorResponse('Method not allowed', 405);
}
