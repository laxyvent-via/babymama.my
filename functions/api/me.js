import { requireAdmin, successResponse, handleOptions } from './_auth.js';
export async function onRequest(ctx) {
  if (ctx.request.method === 'OPTIONS') return handleOptions();
  const admin = await requireAdmin(ctx.request, ctx.env);
  if (admin instanceof Response) return admin;
  return successResponse({ username: admin.username, display_name: admin.display_name, role: admin.role });
}
