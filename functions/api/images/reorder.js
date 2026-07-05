// PUT /api/images/reorder — admin batch reorder
// reorder.js is a literal route (not bracket), so params is unused

import { requireAdmin, successResponse, errorResponse, handleOptions } from '../_auth.js';
import { parseHardcodedId, updateHardcodedOrder } from '../_hardcoded-images.js';

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();
  if (request.method !== 'PUT') return errorResponse('Method not allowed', 405);

  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  try {
    const { order } = await request.json();
    if (!Array.isArray(order) || !order.length) {
      return errorResponse('order must be a non-empty array of image IDs', 400);
    }

    const hardcodedOrder = order.filter(id => parseHardcodedId(id));
    if (hardcodedOrder.length) await updateHardcodedOrder(env, hardcodedOrder);

    const stmt = env.DB.prepare('UPDATE lamda_package_images SET sort_order = ? WHERE id = ?');
    for (let i = 0; i < order.length; i++) {
      const id = parseInt(order[i], 10);
      if (!id || isNaN(id)) continue;
      if (parseHardcodedId(id)) continue;
      await stmt.bind(i, id).run();
    }

    return successResponse({ success: true, count: order.length, hardcoded_count: hardcodedOrder.length });
  } catch (e) {
    return errorResponse('Re-order failed: ' + (e.message || 'unknown error'), 500);
  }
}
