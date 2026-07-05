// POST /api/orders — public (create order with items + addons + customization)
// GET  /api/orders — admin (list all orders)

import { requireAdmin, parseBody, successResponse, errorResponse, handleOptions } from './_auth.js';

async function ensureOrderProgressColumns(env) {
  const cols = [
    'status TEXT DEFAULT \'NEW\'',
    'progress_status TEXT',
    'completed_at TEXT'
  ];
  for (const colDef of cols) {
    try { await env.DB.prepare(`ALTER TABLE lamda_orders ADD COLUMN ${colDef}`).run(); } catch(e) {}
  }
}

async function updateOrderProgress(env, orderIdRaw, actionRaw) {
  await ensureOrderProgressColumns(env);
  const orderId = String(orderIdRaw || '').trim();
  const action = String(actionRaw || '').trim();
  if (!orderId) return errorResponse('Order ID required', 400);

  let progress = '';
  let completedAt = null;
  let resultStatus = 'NEW'; // default display value for response
  if (action === 'hantar_sulam') {
    progress = 'Hantar Sulam';
    resultStatus = 'HANTAR_SULAM';
  } else if (action === 'order_complete') {
    progress = 'Order Complete';
    resultStatus = 'ORDER_COMPLETE';
    completedAt = new Date().toISOString();
  } else {
    return errorResponse('Invalid action', 400);
  }

  // Only update progress_status + completed_at — NEVER touch status column
  // (status has CHECK constraint: IN ('NEW','CLICKED','CONFIRMED','CANCELLED'))
  const res = await env.DB.prepare(
    'UPDATE lamda_orders SET progress_status = ?1, completed_at = COALESCE(?2, completed_at) WHERE order_id = ?3'
  ).bind(progress, completedAt, orderId).run();
  if (!res.success) return errorResponse('Update failed', 500);
  if ((res.meta?.changes || 0) === 0) return errorResponse('Order not found', 404);
  return successResponse({ success: true, order_id: orderId, status: resultStatus, progress_status: progress, completed_at: completedAt });
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return handleOptions();

  if (request.method === 'GET') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    await ensureOrderProgressColumns(env);
    const { results } = await env.DB.prepare(
      "SELECT o.*, COALESCE(o.status, 'NEW') AS status, (SELECT COUNT(*) FROM lamda_order_items WHERE order_id = o.order_id) AS item_count FROM lamda_orders o ORDER BY o.id DESC LIMIT 100"
    ).all();
    return successResponse({ orders: results });
  }

  if (request.method === 'PUT') {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await parseBody(request);
    return await updateOrderProgress(env, body.order_id, body.action);
  }

  if (request.method === 'POST') {
    try {
    const body = await parseBody(request);
    if (body && body.order_id && body.action) {
      const admin = await requireAdmin(request, env);
      if (admin instanceof Response) return admin;
      return await updateOrderProgress(env, body.order_id, body.action);
    }
    const { customer_name, customer_phone, customer_address, notes, items, addons,
            plan_ready, due_date, sulam_text, color_material } = body;
    if (!customer_name || !customer_phone) return errorResponse('Name and phone required', 400);
    if (!items || !Array.isArray(items) || items.length === 0) return errorResponse('No items', 400);

    // Generate order ID
    const d = new Date();
    const my = new Date(d.getTime() + 8 * 3600 * 1000);
    const yy = String(my.getUTCFullYear()).slice(-2);
    const mm = String(my.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(my.getUTCDate()).padStart(2, '0');
    const prefix = `LM-${yy}${mm}${dd}-`;
    const dateOrder = `${dd}/${mm}/${yy}`;

    const lastRow = await env.DB.prepare("SELECT order_id FROM lamda_orders WHERE order_id LIKE ? ORDER BY id DESC LIMIT 1")
      .bind(prefix + '%').first();
    let running = 1;
    if (lastRow) {
      const parts = lastRow.order_id.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last)) running = last + 1;
    }
    const orderId = prefix + String(running).padStart(4, '0');

    // Calculate subtotal
    let subtotal = 0;
    const packageCache = {};
    for (const item of items) {
      if (!packageCache[item.package_id]) {
        const pkg = await env.DB.prepare('SELECT name, price, promo_price FROM lamda_packages WHERE id = ?').bind(item.package_id).first();
        packageCache[item.package_id] = pkg;
      }
      const pkg = packageCache[item.package_id];
      if (!pkg) continue;
      const price = pkg.promo_price || pkg.price;
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      subtotal += price * qty;
    }

    // Addons
    let addonTotal = 0;
    const addonList = Array.isArray(addons) ? addons : [];
    for (const a of addonList) addonTotal += parseFloat(a.price) || 0;

    const total = subtotal + addonTotal;
    // Deposit 50% daripada total
    const depo = Math.round((total * 0.5) * 100) / 100;
    const balance = Math.round((total - depo) * 100) / 100;

    const addr = customer_address || '';
    const note = notes || '';
    const addonJson = addonList.length ? JSON.stringify(addonList) : null;
    const pl = plan_ready || '';
    const dd2 = due_date || '';
    const sulam = sulam_text || '';
    const color = color_material || '';

    // Ensure columns exist
    const newCols = [
      'plan_ready TEXT', 'due_date TEXT', 'sulam_text TEXT', 'color_material TEXT'
    ];
    for (const colDef of newCols) {
      try { await env.DB.prepare(`ALTER TABLE lamda_orders ADD COLUMN ${colDef}`).run(); } catch(e) {}
    }
    try { await env.DB.prepare("ALTER TABLE lamda_orders ADD COLUMN addons TEXT").run(); } catch(e) {}

    // Insert order
    await env.DB.prepare(
      'INSERT INTO lamda_orders (order_id, customer_name, customer_phone, customer_address, notes, subtotal, total, addons, plan_ready, due_date, sulam_text, color_material) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)'
    ).bind(orderId, customer_name, customer_phone, addr, note, subtotal, total, addonJson, pl, dd2, sulam, color).run();

    // Insert items
    for (const item of items) {
      const pkg = packageCache[item.package_id];
      if (!pkg) continue;
      const price = pkg.promo_price || pkg.price;
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      const itemTotal = price * qty;
      await env.DB.prepare('INSERT INTO lamda_order_items (order_id, package_id, package_name, quantity, unit_price, subtotal) VALUES (?1,?2,?3,?4,?5,?6)')
        .bind(orderId, item.package_id, pkg.name, qty, price, itemTotal).run();
    }

    // === WhatsApp Message — top reference format ===
    // IMPORTANT: build as plain text first, then encodeURIComponent() once.
    // Raw #, &, +, emoji, or newlines inside wa.me URL can truncate the WhatsApp message.
    const formatDate = (v) => {
      if (!v) return '-';
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      return String(v);
    };
    const money = (n) => 'RM' + Number(n || 0).toFixed(2);
    const pkgNames = [...new Set(items.map(i => {
      const p = packageCache[i.package_id];
      return p ? p.name : '';
    }).filter(Boolean))];
    const orderTitle = pkgNames.length === 1 ? pkgNames[0] : (pkgNames.join(' + ') || 'Order');
    const itemCount = items.reduce((s, i) => s + Math.max(1, parseInt(i.quantity) || 1), 0);
    const addonNames = addonList.map(a => a.name || 'Add-on').filter(Boolean);
    const submittedAt = new Intl.DateTimeFormat('ms-MY', {
      timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(d);

    const waLines = [];
    waLines.push('ORDER FORM BABYMAMA BARU');
    waLines.push('');
    waLines.push('Detail Customer');
    waLines.push('Nama: ' + customer_name);
    waLines.push('No Whatsapp: ' + customer_phone);
    waLines.push('Alamat: ' + (addr || '-'));
    waLines.push('');
    waLines.push('Order Dipilih');
    waLines.push('Pakej: ' + orderTitle);
    waLines.push('Jumlah Unit: ' + itemCount);
    waLines.push('');
    waLines.push('Detail Order');
    let lineNo = 1;
    for (const item of items) {
      const pkg = packageCache[item.package_id];
      if (!pkg) continue;
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      waLines.push(lineNo + ') Pakej: ' + pkg.name + ' | Qty: ' + qty + ' | Sulam: ' + (sulam || '-') + ' | Warna/Material: ' + (color || '-'));
      lineNo += 1;
    }
    if (addonList.length) {
      waLines.push('Tambahan: ' + addonNames.join(', '));
    }
    waLines.push('');
    waLines.push('Appointment');
    waLines.push('Plan Ready: ' + formatDate(pl));
    waLines.push('Due Date: ' + formatDate(dd2));
    waLines.push('Nota: ' + (note || '-'));
    waLines.push('');
    waLines.push('Anggaran Harga');
    waLines.push(money(subtotal) + ' produk');
    if (addonTotal > 0) waLines.push('Tambahan ' + money(addonTotal));
    waLines.push('Anggaran dari ' + money(total));
    waLines.push('Deposit 50%: ' + money(depo));
    waLines.push('Balance: ' + money(balance));
    waLines.push('');
    waLines.push('Harga sebenar bergantung kepada pilihan design, add-on dan pengesahan admin.');
    waLines.push('📌 Slot tempahan tertakluk kepada availability Babymama.');
    waLines.push('');
    waLines.push('Order ID: ' + orderId);
    waLines.push('Masa Submit: ' + submittedAt);

    const waText = waLines.join('\n');
    const setting = await env.DB.prepare("SELECT value FROM lamda_settings WHERE key = 'whatsapp_number'").first();
    const waNum = (setting?.value || '60123456789').replace(/[^0-9]/g, '');
    const waUrl = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(waText);

    return successResponse({ order_id: orderId, total, subtotal, addon_total: addonTotal, depo, balance, whatsapp_url: waUrl });
    } catch(e) {
      return errorResponse('Order failed: ' + (e.message || 'unknown error'), 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
