-- database/schema.sql
-- NidhiBook Desktop — Full Schema Reference
-- This file is documentation only; tables are created in services/db.js initDb()

-- ── Core Auth Table (unchanged) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users_local (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── Customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  phone          TEXT    NOT NULL,
  alternate_phone TEXT,
  aadhaar        TEXT,
  address        TEXT,
  notes          TEXT,
  balance        REAL    NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── Products / Inventory ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sku              TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  category         TEXT,
  weight_per_unit  REAL    NOT NULL DEFAULT 0,
  price_per_unit   REAL    NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── Transactions ─────────────────────────────────────────────────────────────
-- type: 'SALE' | 'SETTLEMENT'
CREATE TABLE IF NOT EXISTS transactions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id           INTEGER NOT NULL REFERENCES customers(id),
  type                  TEXT    NOT NULL CHECK(type IN ('SALE','SETTLEMENT')),
  total_weight          REAL    NOT NULL DEFAULT 0,
  subtotal              REAL    NOT NULL DEFAULT 0,
  global_discount       REAL    NOT NULL DEFAULT 0,
  final_cost            REAL    NOT NULL DEFAULT 0,
  amount_paid           REAL    NOT NULL DEFAULT 0,
  due_amount            REAL    NOT NULL DEFAULT 0,
  transport_source      TEXT,
  transport_destination TEXT,
  transport_cost        REAL    NOT NULL DEFAULT 0,
  labour_cost           REAL    NOT NULL DEFAULT 0,
  commission_percentage REAL    NOT NULL DEFAULT 0,
  commission_amount     REAL    NOT NULL DEFAULT 0,
  other_cost            REAL    NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── Transaction Items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  quantity       REAL    NOT NULL DEFAULT 0,
  weight         REAL    NOT NULL DEFAULT 0,
  rate           REAL    NOT NULL DEFAULT 0,
  discount       REAL    NOT NULL DEFAULT 0
);
