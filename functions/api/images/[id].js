// GET|PUT|DELETE /api/images/:id — admin get/update/delete image from R2 + D1

import { requireAdmin, successResponse, errorResponse, handleOptions } from '../_auth.js';
import {
  getPackageByHardcodedImageId,
  markHardcodedImageDeleted,
  updateHardcodedCaption,
  updateHardcodedGalleryCategory
} from '../_hardcoded-images.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();

  // Extract ID from URL: /api/images/123
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const imageId = parseInt(parts[parts.length - 1], 10);
  if (!imageId || isNaN(imageId)) return errorResponse('Invalid image ID', 400);

  // GET — fetch single image metadata
  if (request.method === 'GET') {
    try {
      const hardcoded = await getPackageByHardcodedImageId(env, imageId);
      if (hardcoded) {
        const { pkg, cfg, image_index } = hardcoded;
        return successResponse({
          id: imageId,
          package_id: pkg.id,
          image_url: `/images/${cfg.prefix}-${String(image_index).padStart(2, '0')}.${cfg.ext}`,
          caption: '',
          sort_order: image_index,
          hardcoded: true,
          image_index
        });
      }
      const img = await env.DB.prepare('SELECT * FROM lamda_package_images WHERE id = ?').bind(imageId).first();
      if (!img) return errorResponse('Image not found', 404);
      return successResponse(img);
    } catch(e) {
      return errorResponse('Fetch failed: ' + (e.message || 'unknown error'), 500);
    }
  }

  // PUT — update image metadata (caption)
  if (request.method === 'PUT') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    try {
      // Safe migration: ensure gallery_category column exists on lamda_package_images
      try { await env.DB.prepare("ALTER TABLE lamda_package_images ADD COLUMN gallery_category TEXT DEFAULT ''").run(); } catch(e) {}

      const body = await request.json();
      const { caption, gallery_category } = body;

      const hardcoded = await getPackageByHardcodedImageId(env, imageId);
      if (hardcoded) {
        await updateHardcodedCaption(env, hardcoded.package_id, hardcoded.image_index, caption || '');
        if (gallery_category !== undefined) {
          await updateHardcodedGalleryCategory(env, hardcoded.package_id, hardcoded.image_index, gallery_category);
        }
        return successResponse({
          success: true,
          id: imageId,
          package_id: hardcoded.package_id,
          caption: caption || '',
          gallery_category: gallery_category || '',
          hardcoded: true
        });
      }

      // Get existing image
      const img = await env.DB.prepare('SELECT * FROM lamda_package_images WHERE id = ?').bind(imageId).first();
      if (!img) return errorResponse('Image not found', 404);

      // Update fields
      if (caption !== undefined) {
        await env.DB.prepare('UPDATE lamda_package_images SET caption = ? WHERE id = ?').bind(caption, imageId).run();
      }
      if (gallery_category !== undefined) {
        await env.DB.prepare('UPDATE lamda_package_images SET gallery_category = ? WHERE id = ?').bind(gallery_category, imageId).run();
      }

      return successResponse({ success: true, id: imageId, caption: caption ?? img.caption, gallery_category: gallery_category !== undefined ? gallery_category : (img.gallery_category || '') });
    } catch(e) {
      return errorResponse('Update failed: ' + (e.message || 'unknown error'), 500);
    }
  }

  // DELETE — existing delete logic
  if (request.method === 'DELETE') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    try {
      const hardcoded = await getPackageByHardcodedImageId(env, imageId);
      if (hardcoded) {
        await markHardcodedImageDeleted(env, hardcoded.package_id, hardcoded.image_index);
        return successResponse({
          deleted: true,
          id: imageId,
          package_id: hardcoded.package_id,
          hardcoded: true
        });
      }

      const img = await env.DB.prepare('SELECT * FROM lamda_package_images WHERE id = ?').bind(imageId).first();
      if (!img) return errorResponse('Image not found', 404);

      if (img.storage_path) {
        try { await env.R2.delete(img.storage_path); } catch(e) {}
      }

      await env.DB.prepare('DELETE FROM lamda_package_images WHERE id = ?').bind(imageId).run();
      return successResponse({ deleted: true, id: imageId, package_id: img.package_id });
    } catch(e) {
      return errorResponse('Delete failed: ' + (e.message || 'unknown error'), 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
