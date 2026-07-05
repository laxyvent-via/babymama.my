// Shared hardcoded gallery image helpers.
// These images live in /public/images for speed, but admin still needs
// delete/reorder/caption controls. We persist only metadata in D1.

export const HARDCODED_PACKAGE_IMAGES = {
  'set-comforter-newborn': { prefix: 'comforter', ext: 'png', count: 42 },
  'set-tilam-newborn': { prefix: 'tilam-newborn', ext: 'png', count: 19 },
  'pakej-amina': { prefix: 'amina', ext: 'png', count: 25 },
  'pakej-aisyah': { prefix: 'aisyah', ext: 'jpg', count: 22 },
  'pakej-maryam': { prefix: 'maryam', ext: 'jpg', count: 13 },
  'pakej-azzahra': { prefix: 'azzahra', ext: 'jpg', count: 26 },
  'blanket': { prefix: 'blanket', ext: 'jpg', count: 17 }
};

export const HARDCODED_ID_FACTOR = 100000;

export function hardcodedId(packageId, imageIndex) {
  return (Number(packageId) * HARDCODED_ID_FACTOR) + Number(imageIndex);
}

export function parseHardcodedId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < HARDCODED_ID_FACTOR) return null;
  const package_id = Math.floor(n / HARDCODED_ID_FACTOR);
  const image_index = n % HARDCODED_ID_FACTOR;
  if (!package_id || !image_index) return null;
  return { package_id, image_index };
}

export async function ensureHardcodedMetaTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS lamda_hardcoded_image_meta (
      package_id INTEGER NOT NULL,
      image_index INTEGER NOT NULL,
      caption TEXT DEFAULT '',
      sort_order INTEGER,
      hidden INTEGER DEFAULT 0,
      gallery_category TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (package_id, image_index)
    )
  `).run();
  // Add gallery_category column if table already existed without it
  try { await env.DB.prepare("ALTER TABLE lamda_hardcoded_image_meta ADD COLUMN gallery_category TEXT DEFAULT ''").run(); } catch(e) {}
}

export async function getHardcodedImages(env, pkg) {
  const cfg = HARDCODED_PACKAGE_IMAGES[pkg.slug];
  if (!cfg) return null;

  await ensureHardcodedMetaTable(env);
  const { results } = await env.DB.prepare(
    'SELECT image_index, caption, sort_order, hidden, gallery_category FROM lamda_hardcoded_image_meta WHERE package_id = ?'
  ).bind(pkg.id).all();

  const meta = new Map((results || []).map(row => [Number(row.image_index), row]));
  const images = [];
  for (let i = 1; i <= cfg.count; i++) {
    const m = meta.get(i) || {};
    if (Number(m.hidden) === 1) continue;
    images.push({
      id: hardcodedId(pkg.id, i),
      image_url: `/images/${cfg.prefix}-${String(i).padStart(2, '0')}.${cfg.ext}`,
      caption: m.caption || '',
      gallery_category: m.gallery_category || '',
      sort_order: Number.isFinite(Number(m.sort_order)) ? Number(m.sort_order) : i,
      hardcoded: true,
      image_index: i
    });
  }

  images.sort((a, b) => (a.sort_order - b.sort_order) || (a.image_index - b.image_index));
  return images;
}

export async function getPackageByHardcodedImageId(env, imageId) {
  const parsed = parseHardcodedId(imageId);
  if (!parsed) return null;
  const pkg = await env.DB.prepare('SELECT id, slug, name FROM lamda_packages WHERE id = ?')
    .bind(parsed.package_id).first();
  if (!pkg || !HARDCODED_PACKAGE_IMAGES[pkg.slug]) return null;
  const cfg = HARDCODED_PACKAGE_IMAGES[pkg.slug];
  if (parsed.image_index < 1 || parsed.image_index > cfg.count) return null;
  return { ...parsed, pkg, cfg };
}

export async function markHardcodedImageDeleted(env, packageId, imageIndex) {
  await ensureHardcodedMetaTable(env);
  await env.DB.prepare(`
    INSERT INTO lamda_hardcoded_image_meta (package_id, image_index, hidden, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(package_id, image_index) DO UPDATE SET
      hidden = 1,
      updated_at = datetime('now')
  `).bind(packageId, imageIndex).run();
}

export async function updateHardcodedCaption(env, packageId, imageIndex, caption) {
  await ensureHardcodedMetaTable(env);
  await env.DB.prepare(`
    INSERT INTO lamda_hardcoded_image_meta (package_id, image_index, caption, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(package_id, image_index) DO UPDATE SET
      caption = excluded.caption,
      updated_at = datetime('now')
  `).bind(packageId, imageIndex, caption || '').run();
}

export async function updateHardcodedGalleryCategory(env, packageId, imageIndex, category) {
  await ensureHardcodedMetaTable(env);
  await env.DB.prepare(`
    INSERT INTO lamda_hardcoded_image_meta (package_id, image_index, gallery_category, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(package_id, image_index) DO UPDATE SET
      gallery_category = excluded.gallery_category,
      updated_at = datetime('now')
  `).bind(packageId, imageIndex, category || '').run();
}

export async function updateHardcodedOrder(env, order) {
  await ensureHardcodedMetaTable(env);
  for (let i = 0; i < order.length; i++) {
    const parsed = parseHardcodedId(order[i]);
    if (!parsed) continue;
    await env.DB.prepare(`
      INSERT INTO lamda_hardcoded_image_meta (package_id, image_index, sort_order, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(package_id, image_index) DO UPDATE SET
        sort_order = excluded.sort_order,
        updated_at = datetime('now')
    `).bind(parsed.package_id, parsed.image_index, i + 1).run();
  }
}
