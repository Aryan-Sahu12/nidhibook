/**
 * services/db.js
 *
 * SQLite database service layer using @tauri-apps/plugin-sql.
 *
 * The database file is stored in the platform's app-data directory:
 *   macOS  → ~/Library/Application Support/com.nidhibook.desktop/nidhibook.db
 *   Windows→ %APPDATA%\com.nidhibook.desktop\nidhibook.db
 *   Linux  → ~/.local/share/com.nidhibook.desktop/nidhibook.db
 *
 * Exports:
 *   initDb()                        — open connection + create tables
 *   createUser(name, email)         — INSERT
 *   getUsers()                      — SELECT all
 *   updateUser(id, name, email)     — UPDATE by id
 *   deleteUser(id)                  — DELETE by id
 */

import Database from '@tauri-apps/plugin-sql';

/** Singleton DB connection */
let db = null;

/** Connection string understood by tauri-plugin-sql */
const DB_PATH = 'sqlite:nidhibook.db';

/**
 * Initialize the database.
 * Opens the SQLite file (creates it if missing) and ensures all tables exist.
 * Call this once at application startup before any other db function.
 *
 * @returns {Promise<void>}
 */
export async function initDb() {
  try {
    db = await Database.load(DB_PATH);

    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users_local (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        email      TEXT    NOT NULL UNIQUE,
        created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
    `);

    console.info('[DB] Database initialized successfully.');
  } catch (err) {
    console.error('[DB] Initialization failed:', err);
    throw new Error(`Database initialization failed: ${err.message || err}`);
  }
}

/**
 * Assert that the database has been initialized.
 * @private
 */
function _assertDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() before using db operations.');
  }
}

/**
 * Create a new user record.
 * @param {string} name
 * @param {string} email
 * @returns {Promise<{ lastInsertId: number }>}
 */
export async function createUser(name, email) {
  _assertDb();
  try {
    const result = await db.execute(
      'INSERT INTO users_local (name, email) VALUES ($1, $2)',
      [name.trim(), email.trim().toLowerCase()]
    );
    return result;
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      throw new Error(`A user with email "${email}" already exists.`);
    }
    throw new Error(`Failed to create user: ${err.message || err}`);
  }
}

/**
 * Retrieve all users ordered by creation date (newest first).
 * @returns {Promise<Array<{ id: number, name: string, email: string, created_at: string }>>}
 */
export async function getUsers() {
  _assertDb();
  try {
    const rows = await db.select(
      'SELECT id, name, email, created_at FROM users_local ORDER BY id DESC'
    );
    return rows;
  } catch (err) {
    throw new Error(`Failed to fetch users: ${err.message || err}`);
  }
}

/**
 * Update an existing user by ID.
 * @param {number} id
 * @param {string} name
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function updateUser(id, name, email) {
  _assertDb();
  try {
    await db.execute(
      'UPDATE users_local SET name = $1, email = $2 WHERE id = $3',
      [name.trim(), email.trim().toLowerCase(), id]
    );
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      throw new Error(`A user with email "${email}" already exists.`);
    }
    throw new Error(`Failed to update user: ${err.message || err}`);
  }
}

/**
 * Delete a user by ID.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteUser(id) {
  _assertDb();
  try {
    await db.execute('DELETE FROM users_local WHERE id = $1', [id]);
  } catch (err) {
    throw new Error(`Failed to delete user: ${err.message || err}`);
  }
}
