/**
 * ADUKE ALAGBO - UNIFIED DATABASE MODULE
 * =======================================
 * Supports PostgreSQL Cloud SQL Database when DATABASE_URL is set,
 * with seamless automatic fallback to persistent JSON storage.
 * 
 * Auto-creates SQL schema on startup and migrates existing JSON records.
 */

const fs = require('fs');
const path = require('path');

// Optional PostgreSQL driver (graceful if not installed)
let pg = null;
try {
  pg = require('pg');
} catch (e) {
  // pg is listed in package.json and will be installed on deployment
}

// Data Directory for JSON fallback
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'custom-products.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');

let pool = null;
let sqlConnected = false;

// Initialize PostgreSQL connection pool if DATABASE_URL is configured
function setupSqlPool() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !pg) {
    if (!dbUrl) {
      console.log('ℹ️ [DB] DATABASE_URL not set. Running with resilient local file storage.');
    } else {
      console.log('ℹ️ [DB] pg driver not loaded. Running with resilient local file storage.');
    }
    return;
  }

  try {
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 6000
    });

    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.warn('⚠️ [SQL DB WARN] Could not connect to PostgreSQL:', err.message);
        console.warn('ℹ️ [SQL DB] Falling back to file storage.');
        sqlConnected = false;
      } else {
        sqlConnected = true;
        console.log('\n======================================================');
        console.log('🌿 [SQL DB] CONNECTED TO POSTGRESQL CLOUD DATABASE ✓');
        console.log(`⚡ Connected at: ${res.rows[0].now}`);
        console.log('🔐 Orders, catalog, and inventory are backed by SQL.');
        console.log('======================================================\n');
        initSqlTables();
      }
    });
  } catch (err) {
    console.warn('⚠️ [SQL DB ERROR] Initialization error:', err.message);
    sqlConnected = false;
  }
}

// Create SQL Tables & auto-migrate JSON data
async function initSqlTables() {
  if (!pool || !sqlConnected) return;

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS aduke_orders (
      order_ref VARCHAR(100) PRIMARY KEY,
      customer_name VARCHAR(255),
      customer_phone VARCHAR(100),
      customer_email VARCHAR(255),
      customer_address TEXT,
      customer_notes TEXT,
      sender_bank VARCHAR(100),
      sender_name VARCHAR(255),
      sender_session_id VARCHAR(255),
      shipping_method VARCHAR(100),
      shipping_fee NUMERIC(12, 2) DEFAULT 0,
      discount NUMERIC(12, 2) DEFAULT 0,
      subtotal NUMERIC(12, 2) DEFAULT 0,
      final_total NUMERIC(12, 2) DEFAULT 0,
      payment_method VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending',
      admin_alert_email_sent BOOLEAN DEFAULT FALSE,
      payment_confirmed_email_sent BOOLEAN DEFAULT FALSE,
      order_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS aduke_inventory (
      product_id VARCHAR(100) PRIMARY KEY,
      stock INTEGER DEFAULT 35,
      low_stock_threshold INTEGER DEFAULT 8,
      last_restocked TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS aduke_reviews (
      id VARCHAR(100) PRIMARY KEY,
      product_id VARCHAR(100),
      customer_name VARCHAR(255),
      rating INTEGER DEFAULT 5,
      comment TEXT,
      verified BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS aduke_products (
      id VARCHAR(100) PRIMARY KEY,
      product_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS aduke_auth (
      id VARCHAR(50) PRIMARY KEY,
      password_hash VARCHAR(255),
      admin_email VARCHAR(255),
      is_default_password BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(schemaSql);
    console.log('[SQL DB] All Aduke Alagbo SQL tables verified/created successfully.');
    await autoMigrateJsonToSql();
  } catch (err) {
    console.error('[SQL DB SCHEMA ERROR]:', err.message);
  }
}

// Auto-migrate JSON seed data into SQL if database is fresh
async function autoMigrateJsonToSql() {
  if (!pool || !sqlConnected) return;

  try {
    // Check orders
    const countRes = await pool.query('SELECT COUNT(*) FROM aduke_orders');
    const orderCount = parseInt(countRes.rows[0].count, 10);
    if (orderCount === 0) {
      const localOrders = getStoredOrdersFromFile();
      if (Array.isArray(localOrders) && localOrders.length > 0) {
        console.log(`[SQL DB MIGRATION] Migrating ${localOrders.length} orders from JSON to PostgreSQL...`);
        for (const o of localOrders) {
          await saveOrderToSql(o);
        }
        console.log('[SQL DB MIGRATION] Orders migration complete ✓');
      }
    }

    // Check inventory
    const invCountRes = await pool.query('SELECT COUNT(*) FROM aduke_inventory');
    if (parseInt(invCountRes.rows[0].count, 10) === 0) {
      const localInv = getStoredInventoryFromFile();
      for (const [id, item] of Object.entries(localInv)) {
        await pool.query(
          `INSERT INTO aduke_inventory (product_id, stock, low_stock_threshold, last_restocked, updated_at)
           VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (product_id) DO NOTHING`,
          [id, item.stock || 35, item.lowStockThreshold || 8, item.lastRestocked || new Date().toISOString()]
        );
      }
    }
  } catch (err) {
    console.warn('[SQL DB MIGRATION WARN]:', err.message);
  }
}

// -------------------------------------------------------------
// FILE STORAGE FALLBACK HELPERS
// -------------------------------------------------------------

function getStoredOrdersFromFile() {
  if (!fs.existsSync(ORDERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveStoredOrdersToFile(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[FILE SAVE WARN] Could not save orders.json:', e.message);
  }
}

function getStoredInventoryFromFile() {
  if (!fs.existsSync(INVENTORY_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveStoredInventoryToFile(inv) {
  try {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inv, null, 2), 'utf-8');
  } catch (e) {}
}

function getStoredReviewsFromFile() {
  if (!fs.existsSync(REVIEWS_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveStoredReviewsToFile(revs) {
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(revs, null, 2), 'utf-8');
  } catch (e) {}
}

function getStoredAuthFromFile() {
  if (!fs.existsSync(AUTH_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function saveStoredAuthToFile(data) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

// -------------------------------------------------------------
// POSTGRESQL CRUD IMPLEMENTATIONS
// -------------------------------------------------------------

async function saveOrderToSql(order) {
  if (!pool || !sqlConnected || !order || !order.orderRef) return null;

  const cust = order.customer || {};
  const sender = order.senderDetails || {};
  const cleanRef = (order.orderRef || '').toString().trim();
  const createdAt = order.createdAt || order.timestamp || new Date().toISOString();

  const query = `
    INSERT INTO aduke_orders (
      order_ref, customer_name, customer_phone, customer_email,
      customer_address, customer_notes, sender_bank, sender_name,
      sender_session_id, shipping_method, shipping_fee, discount,
      subtotal, final_total, payment_method, status,
      admin_alert_email_sent, payment_confirmed_email_sent,
      order_data, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
    )
    ON CONFLICT (order_ref) DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      customer_phone = EXCLUDED.customer_phone,
      customer_email = EXCLUDED.customer_email,
      customer_address = EXCLUDED.customer_address,
      customer_notes = EXCLUDED.customer_notes,
      status = EXCLUDED.status,
      admin_alert_email_sent = aduke_orders.admin_alert_email_sent OR EXCLUDED.admin_alert_email_sent,
      payment_confirmed_email_sent = aduke_orders.payment_confirmed_email_sent OR EXCLUDED.payment_confirmed_email_sent,
      order_data = EXCLUDED.order_data,
      updated_at = NOW()
    RETURNING order_data;
  `;

  const values = [
    cleanRef,
    cust.name || 'Customer',
    cust.phone || '',
    cust.email || '',
    cust.address || '',
    cust.notes || '',
    sender.bank || '',
    sender.name || '',
    sender.sessionId || '',
    order.shippingMethod || 'standard',
    Number(order.shippingFee || 0),
    Number(order.discount || 0),
    Number(order.subtotal || 0),
    Number(order.finalTotal || 0),
    order.paymentMethod || 'bank',
    order.status || 'pending',
    Boolean(order.adminAlertEmailSent),
    Boolean(order.paymentConfirmedEmailSent),
    JSON.stringify(order),
    createdAt
  ];

  try {
    const res = await pool.query(query, values);
    return res.rows[0] ? res.rows[0].order_data : order;
  } catch (err) {
    console.error('[SQL SAVE ORDER ERROR]:', err.message);
    return null;
  }
}

// -------------------------------------------------------------
// PUBLIC UNIFIED API (AUTOMATIC SQL OR FILE FALLBACK)
// -------------------------------------------------------------

function isSqlActive() {
  return Boolean(pool && sqlConnected);
}

async function getOrders() {
  if (isSqlActive()) {
    try {
      const res = await pool.query('SELECT order_data FROM aduke_orders ORDER BY created_at DESC LIMIT 1000');
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => r.order_data);
      }
    } catch (err) {
      console.warn('[SQL GET ORDERS WARN]:', err.message);
    }
  }
  return getStoredOrdersFromFile();
}

async function saveOrder(order) {
  if (!order || !order.orderRef) return null;

  // Always update local file mirror for zero-loss redundancy
  const localOrders = getStoredOrdersFromFile();
  const existingIdx = localOrders.findIndex(o => o.orderRef === order.orderRef);
  let savedOrder;
  if (existingIdx >= 0) {
    localOrders[existingIdx] = {
      ...localOrders[existingIdx],
      ...order,
      adminAlertEmailSent: localOrders[existingIdx].adminAlertEmailSent || order.adminAlertEmailSent || false,
      paymentConfirmedEmailSent: localOrders[existingIdx].paymentConfirmedEmailSent || order.paymentConfirmedEmailSent || false
    };
    savedOrder = localOrders[existingIdx];
  } else {
    savedOrder = { ...order };
    localOrders.unshift(savedOrder);
  }
  if (localOrders.length > 1000) localOrders.length = 1000;
  saveStoredOrdersToFile(localOrders);

  // Update Inventory in local mirror
  if (Array.isArray(order.items)) {
    const inv = getStoredInventoryFromFile();
    order.items.forEach(it => {
      const id = it.id;
      if (!inv[id]) inv[id] = { stock: 35, lowStockThreshold: 8, lastRestocked: new Date().toISOString() };
      const qty = Number(it.quantity) || 1;
      inv[id].stock = Math.max(0, (inv[id].stock || 35) - qty);
      inv[id].updatedAt = new Date().toISOString();
    });
    saveStoredInventoryToFile(inv);
  }

  // If SQL is active, save to PostgreSQL
  if (isSqlActive()) {
    try {
      await saveOrderToSql(savedOrder);
      // Update inventory in SQL
      if (Array.isArray(order.items)) {
        for (const it of order.items) {
          const qty = Number(it.quantity) || 1;
          await pool.query(
            `INSERT INTO aduke_inventory (product_id, stock, updated_at)
             VALUES ($1, GREATEST(0, 35 - $2), NOW())
             ON CONFLICT (product_id) DO UPDATE SET
               stock = GREATEST(0, aduke_inventory.stock - $2),
               updated_at = NOW()`,
            [it.id, qty]
          );
        }
      }
    } catch (err) {
      console.warn('[SQL SAVE ORDER WARN]:', err.message);
    }
  }

  return savedOrder;
}

async function updateOrderStatus(orderRef, newStatus, note = '') {
  const clean = (r) => (r || '').toString().trim().replace(/^#/, '').toLowerCase();
  const targetClean = clean(orderRef);

  // Update local file mirror
  const orders = getStoredOrdersFromFile();
  const order = orders.find(o => clean(o.orderRef) === targetClean);
  if (order) {
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: note || `Status changed to ${newStatus}`
    });
    if (newStatus === 'verified') {
      order.paymentConfirmedEmailSent = true;
    }
    saveStoredOrdersToFile(orders);
  }

  // Update in SQL
  if (isSqlActive()) {
    try {
      const fetchRes = await pool.query(
        `SELECT order_data FROM aduke_orders WHERE LOWER(TRIM(LEADING '#' FROM order_ref)) = $1`,
        [targetClean]
      );
      if (fetchRes.rows.length > 0) {
        const sqlOrder = fetchRes.rows[0].order_data;
        sqlOrder.status = newStatus;
        sqlOrder.updatedAt = new Date().toISOString();
        if (!Array.isArray(sqlOrder.statusHistory)) sqlOrder.statusHistory = [];
        sqlOrder.statusHistory.push({
          status: newStatus,
          timestamp: new Date().toISOString(),
          note: note || `Status changed to ${newStatus}`
        });
        if (newStatus === 'verified') {
          sqlOrder.paymentConfirmedEmailSent = true;
        }

        await pool.query(
          `UPDATE aduke_orders SET
            status = $1,
            payment_confirmed_email_sent = payment_confirmed_email_sent OR $2,
            order_data = $3,
            updated_at = NOW()
           WHERE LOWER(TRIM(LEADING '#' FROM order_ref)) = $4`,
          [newStatus, newStatus === 'verified', JSON.stringify(sqlOrder), targetClean]
        );
      }
    } catch (err) {
      console.warn('[SQL STATUS UPDATE WARN]:', err.message);
    }
  }

  return order;
}

async function deleteOrder(orderRef) {
  const clean = (r) => (r || '').toString().trim().replace(/^#/, '').toLowerCase();
  const targetClean = clean(orderRef);

  // Update local file mirror
  let orders = getStoredOrdersFromFile();
  orders = orders.filter(o => clean(o.orderRef) !== targetClean);
  saveStoredOrdersToFile(orders);

  // Delete from SQL
  if (isSqlActive()) {
    try {
      await pool.query(
        `DELETE FROM aduke_orders WHERE LOWER(TRIM(LEADING '#' FROM order_ref)) = $1`,
        [targetClean]
      );
    } catch (err) {
      console.warn('[SQL DELETE ORDER WARN]:', err.message);
    }
  }

  return true;
}

async function getInventory() {
  if (isSqlActive()) {
    try {
      const res = await pool.query('SELECT product_id, stock, low_stock_threshold, last_restocked FROM aduke_inventory');
      if (res.rows && res.rows.length > 0) {
        const inv = {};
        res.rows.forEach(r => {
          inv[r.product_id] = {
            stock: r.stock,
            lowStockThreshold: r.low_stock_threshold,
            lastRestocked: r.last_restocked
          };
        });
        return inv;
      }
    } catch (err) {
      console.warn('[SQL GET INVENTORY WARN]:', err.message);
    }
  }
  return getStoredInventoryFromFile();
}

async function saveInventory(inv) {
  saveStoredInventoryToFile(inv);

  if (isSqlActive() && inv) {
    try {
      for (const [id, item] of Object.entries(inv)) {
        await pool.query(
          `INSERT INTO aduke_inventory (product_id, stock, low_stock_threshold, last_restocked, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (product_id) DO UPDATE SET
             stock = EXCLUDED.stock,
             low_stock_threshold = EXCLUDED.low_stock_threshold,
             last_restocked = EXCLUDED.last_restocked,
             updated_at = NOW()`,
          [id, item.stock || 35, item.lowStockThreshold || 8, item.lastRestocked || new Date().toISOString()]
        );
      }
    } catch (err) {
      console.warn('[SQL SAVE INVENTORY WARN]:', err.message);
    }
  }
}

async function getReviews() {
  if (isSqlActive()) {
    try {
      const res = await pool.query('SELECT * FROM aduke_reviews ORDER BY created_at DESC');
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => ({
          id: r.id,
          productId: r.product_id,
          customerName: r.customer_name,
          rating: r.rating,
          comment: r.comment,
          verified: r.verified,
          createdAt: r.created_at
        }));
      }
    } catch (err) {
      console.warn('[SQL GET REVIEWS WARN]:', err.message);
    }
  }
  return getStoredReviewsFromFile();
}

async function saveReview(review) {
  const reviews = getStoredReviewsFromFile();
  reviews.unshift(review);
  saveStoredReviewsToFile(reviews);

  if (isSqlActive() && review) {
    try {
      await pool.query(
        `INSERT INTO aduke_reviews (id, product_id, customer_name, rating, comment, verified, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          review.id,
          review.productId || 'agbo-jedi-extra',
          review.customerName || 'Customer',
          Number(review.rating || 5),
          review.comment || '',
          Boolean(review.verified !== false),
          review.createdAt || new Date().toISOString()
        ]
      );
    } catch (err) {
      console.warn('[SQL SAVE REVIEW WARN]:', err.message);
    }
  }
  return review;
}

async function deleteReview(reviewId) {
  let reviews = getStoredReviewsFromFile();
  reviews = reviews.filter(r => r.id !== reviewId);
  saveStoredReviewsToFile(reviews);

  if (isSqlActive()) {
    try {
      await pool.query('DELETE FROM aduke_reviews WHERE id = $1', [reviewId]);
    } catch (err) {
      console.warn('[SQL DELETE REVIEW WARN]:', err.message);
    }
  }
  return true;
}

async function getAuth() {
  if (isSqlActive()) {
    try {
      const res = await pool.query('SELECT * FROM aduke_auth WHERE id = $1', ['primary']);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          passwordHash: r.password_hash,
          adminEmail: r.admin_email,
          isDefaultPassword: r.is_default_password,
          updatedAt: r.updated_at
        };
      }
    } catch (err) {
      console.warn('[SQL GET AUTH WARN]:', err.message);
    }
  }
  return getStoredAuthFromFile();
}

async function saveAuth(authData) {
  saveStoredAuthToFile(authData);

  if (isSqlActive() && authData) {
    try {
      await pool.query(
        `INSERT INTO aduke_auth (id, password_hash, admin_email, is_default_password, updated_at)
         VALUES ('primary', $1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           admin_email = EXCLUDED.admin_email,
           is_default_password = EXCLUDED.is_default_password,
           updated_at = NOW()`,
        [authData.passwordHash, authData.adminEmail, Boolean(authData.isDefaultPassword)]
      );
    } catch (err) {
      console.warn('[SQL SAVE AUTH WARN]:', err.message);
    }
  }
}

// Start pool immediately
setupSqlPool();

module.exports = {
  isSqlActive,
  getOrders,
  saveOrder,
  updateOrderStatus,
  deleteOrder,
  getInventory,
  saveInventory,
  getReviews,
  saveReview,
  deleteReview,
  getAuth,
  saveAuth
};
