-- ==========================================================
-- Lamda Landing — Database Schema
-- Run: npx wrangler d1 execute babymama-db --remote --command="..."
-- ==========================================================

CREATE TABLE IF NOT EXISTS lamda_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL DEFAULT 0,
  promo_price REAL DEFAULT NULL,
  badge TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','hidden')),
  whatsapp_text TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lamda_package_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT DEFAULT '',
  gallery_category TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (package_id) REFERENCES lamda_packages(id) ON DELETE CASCADE
);

-- Insert 10 packages
INSERT OR IGNORE INTO lamda_packages (slug, name, description, price, sort_order) VALUES
  ('set-comforter-newborn', 'Set Comforter Newborn', 'Set tilam comforter lengkap untuk newborn', 129.00, 1),
  ('set-tilam-newborn', 'Set Tilam Newborn', 'Set tilam premium untuk newborn', 149.00, 2),
  ('pakej-amina', 'Pakej Amina', 'Pakej lengkap Amina', 169.00, 3),
  ('pakej-aisyah', 'Pakej Aisyah', 'Pakej lengkap Aisyah', 189.00, 4),
  ('pakej-maryam', 'Pakej Maryam', 'Pakej lengkap Maryam', 199.00, 5),
  ('pakej-azzahra', 'Pakej Azzahra', 'Pakej lengkap Azzahra', 219.00, 6),
  ('blanket', 'Blanket', 'Blanket baby premium', 89.00, 7),
  ('nursing-pillow', 'Nursing Pillow', 'Bantal nursing premium', 99.00, 8),
  ('set-bantal', 'Set Bantal', 'Set bantal baby lengkap', 79.00, 9),
  ('soft-toys', 'Soft Toys', 'Mainan lembut baby', 59.00, 10);
