// GET /api/packages/:id — public: returns package details + all gallery images
// PUT /api/packages/:id — admin update
// DELETE /api/packages/:id — admin delete

import { requireAdmin, parseBody, successResponse, errorResponse, handleOptions } from '../_auth.js';
import { getHardcodedImages } from '../_hardcoded-images.js';

const COLS = new Set(['slug', 'name', 'description', 'price', 'promo_price', 'badge', 'sort_order', 'status', 'whatsapp_text', 'full_cotton_price', 'minky_mix_cotton_price', 'price_range']);

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();

  const id = parseInt(params.id, 10);
  if (!id || isNaN(id)) return errorResponse('Invalid ID', 400);

  if (request.method === 'GET') {
    const pkg = await env.DB.prepare('SELECT * FROM lamda_packages WHERE id = ?').bind(id).first();
    if (!pkg) return errorResponse('Not found', 404);

    // Use hardcoded static images when configured, but persist admin
    // delete/reorder/caption metadata in D1 so Manage Images still works.
    let images = await getHardcodedImages(env, pkg);
    if (images) {
      // Also fetch uploaded images from R2/D1 and append them
      const uploaded = await loadFromDB(env, id);
      if (uploaded && uploaded.length) {
        images = [...images, ...uploaded];
      }
    } else {
      images = await loadFromDB(env, id);
    }

    return successResponse({ package: pkg, images });
  }

  if (request.method === 'PUT') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    const b = await parseBody(request);
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(b)) {
      if (!COLS.has(k)) continue;
      sets.push(`${k} = ?`); vals.push(v ?? null);
    }
    if (!sets.length) return errorResponse('No fields', 400);
    sets.push("updated_at = datetime('now')"); vals.push(id);
    await env.DB.prepare(`UPDATE lamda_packages SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    return successResponse({ success: true });
  }

  if (request.method === 'DELETE') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    await env.DB.prepare('DELETE FROM lamda_package_images WHERE package_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM lamda_packages WHERE id = ?').bind(id).run();
    return successResponse({ success: true });
  }

  return errorResponse('Method not allowed', 405);
}

async function loadFromDB(env, id) {
  const { results: imgs } = await env.DB.prepare(
    'SELECT id, image_url, caption, sort_order, gallery_category FROM lamda_package_images WHERE package_id = ? ORDER BY sort_order'
  ).bind(id).all();
  return imgs || [];
}
