// GET /api/packages — public list (status=active) or status=all for admin
// POST /api/packages — admin create

import { requireAdmin, parseBody, successResponse, errorResponse, handleOptions } from './_auth.js';

// Hardcoded preview images — same sizes/ratio as Set Comforter Newborn
const PREVIEW_IMAGES = {
  'set-comforter-newborn': '/images/comforter-01.png',
  'set-tilam-newborn': '/images/tilam-newborn-01.png',
  'pakej-amina': '/images/amina-01.png',
  'pakej-aisyah': '/images/aisyah-01.jpg',
  'pakej-maryam': '/images/maryam-01.jpg',
  'pakej-azzahra': '/images/azzahra-01.jpg',
  'blanket': '/images/blanket-01.jpg'
};

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();

  if (request.method === 'GET') {
    // Auto-migrate: add price_range column if not exists
    try { await env.DB.prepare("ALTER TABLE lamda_packages ADD COLUMN price_range TEXT DEFAULT NULL").run(); } catch(e) {}

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'active';
    let q = 'SELECT * FROM lamda_packages';
    let params = [];
    if (status !== 'all') { q += ' WHERE status = ?'; params.push('active'); }
    q += ' ORDER BY sort_order ASC';
    const { results } = params.length
      ? await env.DB.prepare(q).bind(...params).all()
      : await env.DB.prepare(q).all();

    for (const p of results) {
      // Use hardcoded local preview if available (ensures consistent 9:16 ratio)
      if (PREVIEW_IMAGES[p.slug]) {
        p.preview_image = PREVIEW_IMAGES[p.slug];
      } else {
        const img = await env.DB.prepare(
          'SELECT image_url FROM lamda_package_images WHERE package_id = ? ORDER BY sort_order LIMIT 1'
        ).bind(p.id).first();
        p.preview_image = img ? img.image_url : null;
      }
    }
    return successResponse({ packages: results });
  }

  if (request.method === 'POST') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    const b = await parseBody(request);
    if (!b.name) return errorResponse('Name required', 400);
    const slug = b.slug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    const cols = ['slug', 'name', 'description', 'price', 'promo_price', 'badge', 'sort_order', 'status', 'whatsapp_text'];
    await env.DB.prepare(`INSERT INTO lamda_packages (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .bind(slug, b.name, b.description || '', b.price || 0, b.promo_price || null, b.badge || '', b.sort_order || 0, b.status || 'active', b.whatsapp_text || '').run();
    return successResponse({ success: true });
  }

  return errorResponse('Method not allowed', 405);
}
