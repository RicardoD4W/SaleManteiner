-- Migración 001: esquema inicial de la tabla sales (MVP manual)
-- Tabla única. Sin source, sin item_id, sin wallapop_status ni user_status:
-- el scraping/CSV se añaden en migraciones futuras si se reactiva esa dirección.

CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  buyer_name TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  associated_costs_cents INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL,
  sold_at TEXT
);

CREATE INDEX idx_sales_sold ON sales(sold);
CREATE INDEX idx_sales_sold_at ON sales(sold_at);
