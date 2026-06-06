-- database/schema.sql
-- Documentation file: mirrors the CREATE TABLE statement in services/db.js
-- This file is NOT executed at runtime; it exists as a reference for developers.

CREATE TABLE IF NOT EXISTS users_local (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Add additional tables below as your application grows.
-- Follow the same pattern: id, business fields, created_at.
