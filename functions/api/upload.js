// POST /api/upload — admin image upload to R2
import { requireAdmin, parseBody, successResponse, errorResponse, handleOptions } from './_auth.js';

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX = 5 * 1024 * 1024;

function ext(mime) {
  const map = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  return map[mime] || 'jpg';
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const form = await parseBody(request);
  const file = form.get('file');
  const pkgId = parseInt(form.get('package_id') || '0', 10);
  if (!file || !(file instanceof File)) return errorResponse('No file', 400);
  if (!ALLOWED.includes(file.type)) return errorResponse('Invalid type', 400);
  if (file.size > MAX) return errorResponse('Too large, max 5MB', 400);

  const ts = Date.now();
  const filename = `lamda-pkg${pkgId}-${ts}.${ext(file.type)}`;
  const path = `lamda/${filename}`;

  await env.R2.put(path, file.stream(), { httpMetadata: { contentType: file.type } });

  const base = (env.R2_PUBLIC_URL && !env.R2_PUBLIC_URL.includes('unknown'))
    ? env.R2_PUBLIC_URL
    : 'https://pub-b0c14e18e5bd4945a8596774be9a97d3.r2.dev';
  const publicUrl = `${base.replace(/\/$/, '')}/${path}`;

  if (pkgId > 0) {
    // Safe migration: ensure gallery_category column exists
    try { await env.DB.prepare("ALTER TABLE lamda_package_images ADD COLUMN gallery_category TEXT DEFAULT ''").run(); } catch(e) {}
    await env.DB.prepare('INSERT INTO lamda_package_images (package_id, image_url, storage_path, sort_order) VALUES (?, ?, ?, ?)')
      .bind(pkgId, publicUrl, path, ts % 1000000).run();
  }

  return successResponse({ url: publicUrl, path, filename, package_id: pkgId > 0 ? pkgId : null });
}
