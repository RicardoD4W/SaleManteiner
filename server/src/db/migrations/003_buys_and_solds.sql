-- Migración 003: reemplazar tabla sales por 4 tablas nuevas (buys, solds, sale_items, customers).
--
-- Decisión de producto (feature feature-buys-and-solds):
--   - Fresh start: se dropea sales sin preservarla.
--   - Compras: purchase_cost/associated_costs son TOTALES; el unitario se prorratea al vuelo.
--   - Ventas: sale_price/associated_costs son TOTALES de la venta (no por item).
--   - Packs: tabla pivote sale_items (sold_id ON DELETE CASCADE; buy_id ON DELETE RESTRICT).
--   - Clientes: mínimos (id, name, created_at), sin contact.
--   - Importes en euros decimales (SQLite REAL) con validación Zod multipleOf(0.01).
--
-- Índices:
--   - idx_buys_purchase_date       → lista de compras filtrada por fecha.
--   - idx_solds_sold_at            → revenue mensual en dashboard.
--   - idx_solds_customer           → top compradores + detail de venta.
--   - idx_sale_items_buy           → stock disponible por compra.
--   - idx_sale_items_sold          → detalle de venta con items.
--   - idx_customers_name           → autocomplete en form de venta.

-- legacy: drop antes de crear para poder re-ejecutar en tests
DROP TABLE IF EXISTS sale_items;
DROP TABLE IF EXISTS solds;
DROP TABLE IF EXISTS buys;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS sales;

-- ─── customers ─────────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_customers_name ON customers(name);

-- ─── buys ────────────────────────────────────────────────────────────────────
CREATE TABLE buys (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name     TEXT NOT NULL,
  purchase_cost    REAL NOT NULL DEFAULT 0,
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  associated_costs REAL NOT NULL DEFAULT 0,
  purchase_date    TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_buys_purchase_date ON buys(purchase_date);

-- ─── solds ───────────────────────────────────────────────────────────────────
CREATE TABLE solds (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_price       REAL NOT NULL DEFAULT 0,
  associated_costs REAL NOT NULL DEFAULT 0,
  sold_at          TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_solds_sold_at   ON solds(sold_at);
CREATE INDEX idx_solds_customer ON solds(customer_id);

-- ─── sale_items (pivote) ─────────────────────────────────────────────────────
CREATE TABLE sale_items (
  sold_id  INTEGER NOT NULL REFERENCES solds(id)  ON DELETE CASCADE,
  buy_id   INTEGER NOT NULL REFERENCES buys(id)   ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  PRIMARY KEY (sold_id, buy_id)
);

CREATE INDEX idx_sale_items_buy  ON sale_items(buy_id);
CREATE INDEX idx_sale_items_sold ON sale_items(sold_id);
