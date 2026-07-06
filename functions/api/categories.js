// GET /api/categories — public list
// POST /api/categories — admin create

import { requireAdmin, parseBody, successResponse, errorResponse, handleOptions } from './_auth.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();

  // Auto-migrate: create categories table if not exists
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS lamda_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    // Seed default categories if table is empty
    const { results } = await env.DB.prepare('SELECT COUNT(*) as cnt FROM lamda_categories').all();
    if (results[0].cnt === 0) {
      await env.DB.prepare("INSERT INTO lamda_categories (name, sort_order) VALUES ('All', 1), ('Newborn', 2), ('Set', 3), ('Blanket', 4)").run();
    }
  } catch(e) {}

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM lamda_categories ORDER BY sort_order ASC').all();
    return successResponse({ categories: results });
  }

  if (request.method === 'POST') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    const b = await parseBody(request);
    if (!b.name) return errorResponse('Name required', 400);
    await env.DB.prepare('INSERT INTO lamda_categories (name, sort_order) VALUES (?, ?)').bind(b.name, b.sort_order || 0).run();
    return successResponse({ success: true });
  }

  return errorResponse('Method not allowed', 405);
}
