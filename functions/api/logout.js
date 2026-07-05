import { clearSessionCookie, errorResponse, handleOptions } from './_auth.js';
export async function onRequest(ctx) {
  if (ctx.request.method === 'OPTIONS') return handleOptions();
  if (ctx.request.method !== 'POST') return errorResponse('Method not allowed', 405);
  const resp = new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true' } });
  resp.headers.append('Set-Cookie', clearSessionCookie());
  return resp;
}
