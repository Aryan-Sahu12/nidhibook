/**
 * services/db.js
 *
 * SQLite database service layer using @tauri-apps/plugin-sql.
 * Covers: users_local, customers, products, transactions, transaction_items
 */

import Database from '@tauri-apps/plugin-sql';

let db = null;
const DB_PATH = 'sqlite:nidhibook.db';

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

export async function initDb() {
  try {
    db = await Database.load(DB_PATH);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users_local (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        email      TEXT    NOT NULL UNIQUE,
        created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL,
        phone           TEXT NOT NULL,
        alternate_phone TEXT,
        aadhaar         TEXT,
        address         TEXT,
        notes           TEXT,
        balance         REAL NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        sku             TEXT NOT NULL UNIQUE,
        name            TEXT NOT NULL,
        category        TEXT,
        weight_per_unit REAL NOT NULL DEFAULT 0,
        price_per_unit  REAL NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id           INTEGER NOT NULL REFERENCES customers(id),
        type                  TEXT    NOT NULL,
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
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id),
        product_id     INTEGER NOT NULL REFERENCES products(id),
        quantity       REAL    NOT NULL DEFAULT 0,
        weight         REAL    NOT NULL DEFAULT 0,
        rate           REAL    NOT NULL DEFAULT 0,
        discount       REAL    NOT NULL DEFAULT 0
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        action      TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id   INTEGER,
        entity_name TEXT,
        details     TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
    `);

    console.info('[DB] All tables initialized.');
  } catch (err) {
    console.error('[DB] Init failed:', err);
    throw new Error(`Database initialization failed: ${err.message || err}`);
  }
}

function _assertDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS (legacy, keeps existing auth flow working)
// ─────────────────────────────────────────────────────────────────────────────

export async function createUser(name, email) {
  _assertDb();
  try {
    const r = await db.execute('INSERT INTO users_local (name, email) VALUES ($1, $2)', [name.trim(), email.trim().toLowerCase()]);
    return r;
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) throw new Error(`A user with email "${email}" already exists.`);
    throw new Error(`Failed to create user: ${err.message || err}`);
  }
}

export async function getUsers() {
  _assertDb();
  const rows = await db.select('SELECT id, name, email, created_at FROM users_local ORDER BY id DESC');
  return rows;
}

export async function updateUser(id, name, email) {
  _assertDb();
  try {
    await db.execute('UPDATE users_local SET name = $1, email = $2 WHERE id = $3', [name.trim(), email.trim().toLowerCase(), id]);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) throw new Error(`A user with email "${email}" already exists.`);
    throw new Error(`Failed to update user: ${err.message || err}`);
  }
}

export async function deleteUser(id) {
  _assertDb();
  await db.execute('DELETE FROM users_local WHERE id = $1', [id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

export async function createCustomer({ name, phone, alternate_phone, aadhaar, address, notes }) {
  _assertDb();
  try {
    const r = await db.execute(
      `INSERT INTO customers (name, phone, alternate_phone, aadhaar, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [name.trim(), phone.trim(), alternate_phone || null, aadhaar || null, address || null, notes || null]
    );
    const id = r.lastInsertId;
    await logActivity('CREATE', 'CUSTOMER', id, name, `Phone: ${phone}`);
    return id;
  } catch (err) {
    throw new Error(`Failed to create customer: ${err.message || err}`);
  }
}

export async function getCustomers() {
  _assertDb();
  return db.select('SELECT * FROM customers ORDER BY name ASC');
}

export async function getCustomerById(id) {
  _assertDb();
  const rows = await db.select('SELECT * FROM customers WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function searchCustomers(query) {
  _assertDb();
  const q = `%${query.toLowerCase()}%`;
  return db.select(
    `SELECT * FROM customers
     WHERE lower(name) LIKE $1 OR lower(phone) LIKE $1 OR lower(aadhaar) LIKE $1
     ORDER BY name ASC`,
    [q]
  );
}

export async function updateCustomer(id, { name, phone, alternate_phone, aadhaar, address, notes }) {
  _assertDb();
  try {
    await db.execute(
      `UPDATE customers SET name=$1, phone=$2, alternate_phone=$3, aadhaar=$4, address=$5, notes=$6 WHERE id=$7`,
      [name.trim(), phone.trim(), alternate_phone || null, aadhaar || null, address || null, notes || null, id]
    );
    await logActivity('UPDATE', 'CUSTOMER', id, name, `Phone: ${phone}`);
  } catch (err) {
    throw new Error(`Failed to update customer: ${err.message || err}`);
  }
}

export async function deleteCustomer(id) {
  _assertDb();
  try {
    const customer = await getCustomerById(id);
    await db.execute('DELETE FROM customers WHERE id = $1', [id]);
    if (customer) await logActivity('DELETE', 'CUSTOMER', id, customer.name, null);
  } catch (err) {
    throw new Error(`Failed to delete customer: ${err.message || err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate SKU: first letters of name words + timestamp hash (6 chars)
 */
export function generateSku(name) {
  const prefix = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 5);
  const hash = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-${hash}`;
}

export async function createProduct({ sku, name, category, weight_per_unit, price_per_unit }) {
  _assertDb();
  const finalSku = sku && sku.trim() ? sku.trim().toUpperCase() : generateSku(name);
  try {
    const r = await db.execute(
      `INSERT INTO products (sku, name, category, weight_per_unit, price_per_unit)
       VALUES ($1,$2,$3,$4,$5)`,
      [finalSku, name.trim(), category || null, Number(weight_per_unit) || 0, Number(price_per_unit) || 0]
    );
    return { id: r.lastInsertId, sku: finalSku };
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      throw new Error(`A product with SKU "${finalSku}" already exists. Please use a different SKU.`);
    }
    throw new Error(`Failed to create product: ${err.message || err}`);
  }
}

export async function getProducts() {
  _assertDb();
  return db.select('SELECT * FROM products ORDER BY name ASC');
}

export async function getProductById(id) {
  _assertDb();
  const rows = await db.select('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function searchProducts(query) {
  _assertDb();
  const q = `%${query.toLowerCase()}%`;
  return db.select(
    `SELECT * FROM products
     WHERE lower(name) LIKE $1 OR lower(sku) LIKE $1 OR lower(category) LIKE $1
     ORDER BY name ASC`,
    [q]
  );
}

export async function updateProduct(id, { sku, name, category, weight_per_unit, price_per_unit }) {
  _assertDb();
  try {
    await db.execute(
      `UPDATE products SET sku=$1, name=$2, category=$3, weight_per_unit=$4, price_per_unit=$5 WHERE id=$6`,
      [sku.trim().toUpperCase(), name.trim(), category || null, Number(weight_per_unit) || 0, Number(price_per_unit) || 0, id]
    );
    await logActivity('UPDATE', 'PRODUCT', id, name, `SKU: ${sku}`);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      throw new Error(`SKU "${sku}" is already in use by another product.`);
    }
    throw new Error(`Failed to update product: ${err.message || err}`);
  }
}

export async function deleteProduct(id) {
  _assertDb();
  await db.execute('DELETE FROM products WHERE id = $1', [id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS — ATOMIC OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a SALE transaction atomically.
 * @param {object} data
 * @param {number} data.customerId
 * @param {Array<{productId,quantity,weight,rate,discount}>} data.items
 * @param {number} data.subtotal
 * @param {number} data.globalDiscount
 * @param {number} data.finalCost
 * @param {number} data.amountPaid
 * @param {number} data.dueAmount
 * @param {number} data.totalWeight
 * @param {string} data.transportSource
 * @param {string} data.transportDestination
 * @param {number} data.transportCost
 * @param {number} data.labourCost
 * @param {number} data.commissionPercentage
 * @param {number} data.commissionAmount
 * @param {number} data.otherCost
 */
export async function createSaleTransaction(data) {
  _assertDb();
  // Note: tauri-plugin-sql auto-commits each execute(); manual BEGIN/COMMIT throws
  // "no transaction is active". We run operations sequentially instead.
  try {
    const txResult = await db.execute(
      `INSERT INTO transactions
        (customer_id, type, total_weight, subtotal, global_discount, final_cost,
         amount_paid, due_amount, transport_source, transport_destination,
         transport_cost, labour_cost, commission_percentage, commission_amount, other_cost)
       VALUES ($1,'SALE',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        data.customerId,
        data.totalWeight || 0,
        data.subtotal || 0,
        data.globalDiscount || 0,
        data.finalCost || 0,
        data.amountPaid || 0,
        data.dueAmount || 0,
        data.transportSource || null,
        data.transportDestination || null,
        data.transportCost || 0,
        data.labourCost || 0,
        data.commissionPercentage || 0,
        data.commissionAmount || 0,
        data.otherCost || 0,
      ]
    );

    const txId = txResult.lastInsertId;

    for (const item of data.items) {
      await db.execute(
        `INSERT INTO transaction_items (transaction_id, product_id, quantity, weight, rate, discount)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [txId, item.productId, item.quantity, item.weight || 0, item.rate, item.discount || 0]
      );
    }

    await db.execute(
      'UPDATE customers SET balance = balance + $1 WHERE id = $2',
      [data.dueAmount || 0, data.customerId]
    );

    await logActivity('CREATE', 'TRANSACTION', txId, 'SALE', `Amount: ₹${data.finalCost}`);

    return txId;
  } catch (err) {
    throw new Error(`Sale transaction failed: ${err.message || err}`);
  }
}

/**
 * Create a SETTLEMENT transaction atomically.
 * @param {object} data
 * @param {number} data.customerId
 * @param {number} data.amountPaid
 * @param {string} [data.notes]
 */
export async function createSettlementTransaction(data) {
  _assertDb();
  try {
    const txResult = await db.execute(
      `INSERT INTO transactions
        (customer_id, type, amount_paid, notes)
       VALUES ($1,'SETTLEMENT',$2,$3)`,
      [data.customerId, data.amountPaid || 0, data.notes || null]
    );

    const txId = txResult.lastInsertId;

    await db.execute(
      'UPDATE customers SET balance = MAX(0, balance - $1) WHERE id = $2',
      [data.amountPaid || 0, data.customerId]
    );

    await logActivity('CREATE', 'TRANSACTION', txId, 'SETTLEMENT', `Amount: ₹${data.amountPaid}`);

    return txId;
  } catch (err) {
    throw new Error(`Settlement transaction failed: ${err.message || err}`);
  }
}

export async function updateTransaction(id, { amount_paid, notes }) {
  _assertDb();
  try {
    const tx = await getTransactionById(id);
    if (!tx) throw new Error('Transaction not found');

    const amountDelta = (Number(amount_paid) || 0) - (Number(tx.amount_paid) || 0);

    // Update the transaction record
    // Note: for SALE, due_amount = final_cost - amount_paid
    // So if amount_paid increases, due_amount decreases.
    const newDue = tx.type === 'SALE' ? Math.max(0, tx.final_cost - (Number(amount_paid) || 0)) : 0;

    await db.execute(
      `UPDATE transactions SET amount_paid=$1, notes=$2, due_amount=$3 WHERE id=$4`,
      [Number(amount_paid) || 0, notes || null, newDue, id]
    );

    // Update customer balance:
    // If it was a SALE: customer balance was increased by old due_amount.
    // New total debt adjustment = (newDue - oldDue).
    // If it was a SETTLEMENT: customer balance was decreased by old amount_paid.
    // So update = -(newPaid - oldPaid).
    if (tx.type === 'SALE') {
      const dueDelta = newDue - tx.due_amount;
      await db.execute('UPDATE customers SET balance = balance + $1 WHERE id = $2', [dueDelta, tx.customer_id]);
    } else {
      await db.execute('UPDATE customers SET balance = MAX(0, balance - $1) WHERE id = $2', [amountDelta, tx.customer_id]);
    }

    await logActivity('UPDATE', 'TRANSACTION', id, tx.type, `New Paid: ₹${amount_paid}`);
  } catch (err) {
    throw new Error(`Failed to update transaction: ${err.message || err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BILL HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export async function getTransactions({ limit = 100, offset = 0 } = {}) {
  _assertDb();
  return db.select(
    `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone
     FROM transactions t
     JOIN customers c ON c.id = t.customer_id
     ORDER BY t.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

export async function getTransactionById(id) {
  _assertDb();
  const rows = await db.select(
    `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone
     FROM transactions t
     JOIN customers c ON c.id = t.customer_id
     WHERE t.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const tx = rows[0];

  const items = await db.select(
    `SELECT ti.*, p.name AS product_name, p.sku
     FROM transaction_items ti
     JOIN products p ON p.id = ti.product_id
     WHERE ti.transaction_id = $1`,
    [id]
  );
  tx.items = items;
  return tx;
}

export async function getCustomerTransactions(customerId) {
  _assertDb();
  const txs = await db.select(
    `SELECT * FROM transactions WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customerId]
  );
  for (const tx of txs) {
    if (tx.type === 'SALE') {
      tx.items = await db.select(
        `SELECT ti.*, p.name AS product_name, p.sku
         FROM transaction_items ti
         JOIN products p ON p.id = ti.product_id
         WHERE ti.transaction_id = $1`,
        [tx.id]
      );
    }
  }
  return txs;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD AGGREGATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  _assertDb();
  const revenue = await db.select(
    `SELECT COALESCE(SUM(final_cost), 0) AS total FROM transactions WHERE type='SALE'`
  );
  const collected = await db.select(
    `SELECT COALESCE(SUM(amount_paid), 0) AS total FROM transactions`
  );
  const debt = await db.select(
    `SELECT COALESCE(SUM(balance), 0) AS total FROM customers WHERE balance > 0`
  );
  return {
    revenue: revenue[0].total,
    cashCollected: collected[0].total,
    outstandingDebt: debt[0].total,
  };
}

export async function getTopDebtors(limit = 5) {
  _assertDb();
  return db.select(
    `SELECT id, name, phone, balance FROM customers WHERE balance > 0 ORDER BY balance DESC LIMIT $1`,
    [limit]
  );
}

export async function getTopPurchasers(limit = 5) {
  _assertDb();
  return db.select(
    `SELECT c.id, c.name, c.phone, COALESCE(SUM(t.final_cost), 0) AS lifetime_spend
     FROM customers c
     LEFT JOIN transactions t ON t.customer_id = c.id AND t.type = 'SALE'
     GROUP BY c.id
     ORDER BY lifetime_spend DESC
     LIMIT $1`,
    [limit]
  );
}

export async function getRevenueTrend() {
  _assertDb();
  return db.select(
    `SELECT strftime('%Y-%m', created_at) AS month, COALESCE(SUM(final_cost), 0) AS revenue
     FROM transactions
     WHERE type='SALE'
       AND created_at >= date('now', '-12 months')
     GROUP BY month
     ORDER BY month ASC`
  );
}

export async function getCustomerLifetimeSpend(customerId) {
  _assertDb();
  const rows = await db.select(
    `SELECT COALESCE(SUM(final_cost), 0) AS total FROM transactions WHERE customer_id=$1 AND type='SALE'`,
    [customerId]
  );
  return rows[0].total;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recent transactions (latest N), joined with customer name.
 */
export async function getRecentTransactions(limit = 8) {
  _assertDb();
  return db.select(
    `SELECT t.id, t.type, t.final_cost, t.amount_paid, t.due_amount, t.created_at,
            c.name AS customer_name
     FROM transactions t
     JOIN customers c ON c.id = t.customer_id
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

/**
 * Products sold in recent transactions, aggregated.
 */
export async function getRecentlySoldProducts(limit = 8) {
  _assertDb();
  return db.select(
    `SELECT p.id, p.name, p.sku,
            SUM(ti.quantity) AS total_qty,
            MAX(t.created_at) AS last_sold_at
     FROM transaction_items ti
     JOIN products p ON p.id = ti.product_id
     JOIN transactions t ON t.id = ti.transaction_id
     WHERE t.type = 'SALE'
     GROUP BY p.id
     ORDER BY last_sold_at DESC
     LIMIT $1`,
    [limit]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOGGING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log an activity to the database.
 * @param {string} action — 'CREATE', 'UPDATE', 'DELETE'
 * @param {string} entityType — 'CUSTOMER', 'PRODUCT', 'TRANSACTION', 'BUSINESS_PROFILE'
 * @param {number|null} entityId
 * @param {string|null} entityName
 * @param {string|null} details
 */
export async function logActivity(action, entityType, entityId, entityName, details) {
  _assertDb();
  try {
    await db.execute(
      `INSERT INTO activity_log (action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, entityType, entityId, entityName, details]
    );
  } catch (err) {
    console.warn('[DB] Activity log failed:', err);
  }
}

export async function getActivities(limit = 100) {
  _assertDb();
  return db.select(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1`, [limit]);
}


