/**
 * ADUKE ALAGBO - SECURE BACKEND SERVER
 * =====================================
 * Handles secure admin authentication, email password resets,
 * and live catalog synchronization.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./db');

// Load .env configuration file if present
const ENV_PATH = path.join(__dirname, '.env');
if (fs.existsSync(ENV_PATH)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(ENV_PATH);
    } else {
      const envRaw = fs.readFileSync(ENV_PATH, 'utf-8');
      envRaw.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[k]) process.env[k] = v;
          }
        }
      });
    }
  } catch (err) {
    console.warn('[ENV] Could not load .env file:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- SECURITY HEADERS MIDDLEWARE ---
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking in iframes (allow only SAMEORIGIN)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Cross-site scripting legacy filter protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Restrict unused browser device APIs
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https:;"
  );
  // Remove X-Powered-By to prevent server fingerprinting
  res.removeHeader('X-Powered-By');
  next();
});

// --- SENSITIVE FILE PROTECTION SHIELD ---
// Intercept direct HTTP attempts to download environment variables, source code, or private databases
app.use((req, res, next) => {
  const cleanPath = (req.path || '').toLowerCase();
  // Block any hidden/dot files (.env, .git, etc.)
  if (cleanPath.includes('/.') || cleanPath.startsWith('.')) {
    return res.status(403).json({ success: false, message: 'Access Denied: Hidden system files are protected.' });
  }
  // Block internal server, database, and configuration files
  if (
    cleanPath.startsWith('/data') ||
    cleanPath === '/server.js' ||
    cleanPath === '/db.js' ||
    cleanPath === '/package.json' ||
    cleanPath === '/package-lock.json' ||
    cleanPath.endsWith('.json') ||
    cleanPath.endsWith('.md')
  ) {
    return res.status(403).json({ success: false, message: 'Access Denied: Internal application files are protected.' });
  }
  next();
});

// Core middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data Directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'custom-products.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'custom-categories.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const DELETED_ORDERS_FILE = path.join(DATA_DIR, 'deleted-orders.json');
const DELETED_PRODUCTS_FILE = path.join(DATA_DIR, 'deleted-products.json');
const DELETED_CATEGORIES_FILE = path.join(DATA_DIR, 'deleted-categories.json');

// --- CROSS-DEVICE DELETED ENTITIES TRACKING ---
function getDeletedOrders() {
  try {
    if (fs.existsSync(DELETED_ORDERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_ORDERS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveDeletedOrders(list) {
  try {
    fs.writeFileSync(DELETED_ORDERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {}
}

function recordDeletedOrder(orderRef) {
  if (!orderRef) return;
  const clean = (orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const list = getDeletedOrders();
  if (!list.includes(clean)) list.push(clean);
  if (!list.includes(orderRef)) list.push(orderRef);
  saveDeletedOrders(list);
}

function isOrderDeleted(orderRef) {
  if (!orderRef) return false;
  const clean = (orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const list = getDeletedOrders();
  return list.includes(clean) || list.includes(orderRef);
}

function getDeletedProducts() {
  try {
    if (fs.existsSync(DELETED_PRODUCTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_PRODUCTS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveDeletedProducts(list) {
  try {
    fs.writeFileSync(DELETED_PRODUCTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {}
}

function recordDeletedProduct(productId) {
  if (!productId) return;
  const list = getDeletedProducts();
  if (!list.includes(productId)) {
    list.push(productId);
    saveDeletedProducts(list);
  }
}

function unmarkDeletedProduct(productId) {
  if (!productId) return;
  let list = getDeletedProducts();
  list = list.filter(id => id !== productId);
  saveDeletedProducts(list);
}

function getDeletedCategories() {
  try {
    if (fs.existsSync(DELETED_CATEGORIES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_CATEGORIES_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveDeletedCategories(list) {
  try {
    fs.writeFileSync(DELETED_CATEGORIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {}
}

function recordDeletedCategory(catId) {
  if (!catId) return;
  const list = getDeletedCategories();
  if (!list.includes(catId)) {
    list.push(catId);
    saveDeletedCategories(list);
  }
}

function unmarkDeletedCategory(catId) {
  if (!catId) return;
  let list = getDeletedCategories();
  list = list.filter(id => id !== catId);
  saveDeletedCategories(list);
}

// --- CRYPTOGRAPHIC UTILITIES ---
function hashSecret(secret, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(secret, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'utf-8'), Buffer.from(key, 'utf-8'));
}

// Persistent & HMAC-Signed Session Tokens (Survives Render restarts & redeploys)
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days active session

function getSessionSecret() {
  const auth = getAuthData();
  return (auth && auth.passwordHash) ? auth.passwordHash : (process.env.ADMIN_MASTER_KEY || "aduke-alagbo-session-hmac-key");
}

function loadSessions() {
  const map = new Map();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      const now = Date.now();
      for (const [t, exp] of Object.entries(data)) {
        if (typeof exp === 'number' && exp > now) {
          map.set(t, exp);
        }
      }
    }
  } catch (e) {
    console.warn('[SESSIONS] Load error:', e.message);
  }
  return map;
}

function saveSessions(map) {
  try {
    const obj = {};
    for (const [t, exp] of map.entries()) {
      obj[t] = exp;
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('[SESSIONS] Save error:', e.message);
  }
}

const activeSessions = loadSessions();

function createSession() {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const expiry = Date.now() + SESSION_TTL_MS;
  const data = `${randomPart}.${expiry}`;
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('hex');
  const token = `${data}.${sig}`;

  activeSessions.set(token, expiry);
  saveSessions(activeSessions);
  return token;
}

function isValidSession(token) {
  if (!token || typeof token !== 'string') return false;

  // 1. Check in-memory map
  if (activeSessions.has(token)) {
    const expiry = activeSessions.get(token);
    if (Date.now() > expiry) {
      activeSessions.delete(token);
      saveSessions(activeSessions);
      return false;
    }
    return true;
  }

  // 2. Stateless HMAC verification (survives any Render redeploy or restart!)
  const parts = token.split('.');
  if (parts.length === 3) {
    const [randomPart, expiryStr, clientSig] = parts;
    const expiry = Number(expiryStr);
    if (isNaN(expiry) || Date.now() > expiry) {
      return false;
    }
    const data = `${randomPart}.${expiry}`;
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('hex');
    try {
      if (crypto.timingSafeEqual(Buffer.from(clientSig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) {
        activeSessions.set(token, expiry);
        saveSessions(activeSessions);
        return true;
      }
    } catch (e) {}
  }

  return false;
}

// --- AUTHORIZATION MIDDLEWARE FOR ADMIN ENDPOINTS ---
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '').trim() : null;

  if (!isValidSession(token)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Valid admin authentication token required. Please log in.'
    });
  }
  next();
}

// --- RATE LIMITING UTILITY (In-Memory IP Tracker for Auth Endpoints) ---
const loginAttempts = new Map(); // ip -> { count, firstAttempt }
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 6; // Max 6 failed attempts per 15 min

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (now - record.firstAttempt > LOGIN_RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSec = Math.ceil((record.firstAttempt + LOGIN_RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  record.count += 1;
  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// --- EMAIL SENDER CONFIGURATION ---
const SMTP_USER = (process.env.SMTP_USER || "badmusdaniel0508@gmail.com").trim();
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, '');
const DEFAULT_OWNER_EMAIL = (process.env.ADMIN_EMAIL || SMTP_USER || "badmusdaniel0508@gmail.com").trim();
const DEFAULT_INITIAL_PASSWORD = (process.env.ADMIN_INITIAL_PASSWORD || "aduke2026").trim();

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'email***@gmail.com';
  const [name, domain] = email.split('@');
  if (name.length <= 3) {
    return `${name[0]}***@${domain}`;
  }
  return `${name.slice(0, 3)}***@${domain}`;
}

// Transporters: SSL (Port 465), STARTTLS (Port 587), and Service ('gmail')
function createSslTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4, // Force IPv4 on cloud hosts like Render to prevent ENETUNREACH IPv6 errors
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

function createTlsTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // port 587 uses STARTTLS
    family: 4,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

function createServiceTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    connectionTimeout: 8000
  });
}

/**
 * Robust email sender with multi-transport fallback:
 * 1. Port 465 SSL (IPv4 forced)
 * 2. Port 587 STARTTLS (IPv4 forced)
 * 3. Predefined Gmail Service
 */
async function sendMailWithFallback(mailOptions) {
  if (!mailOptions.from) {
    mailOptions.from = `"Aduke Alagbo" <${SMTP_USER}>`;
  }

  // Attempt 1: Port 465 SSL
  try {
    const transporter465 = createSslTransporter();
    const info = await transporter465.sendMail(mailOptions);
    console.log(`[EMAIL DISPATCH] Sent to ${mailOptions.to} via Port 465 SSL (id: ${info.messageId})`);
    return { sent: true, method: 'smtp_465', messageId: info.messageId };
  } catch (err465) {
    console.warn(`[EMAIL DISPATCH WARN] Port 465 SSL failed (${err465.message}). Trying Port 587 STARTTLS...`);
  }

  // Attempt 2: Port 587 STARTTLS
  try {
    const transporter587 = createTlsTransporter();
    const info = await transporter587.sendMail(mailOptions);
    console.log(`[EMAIL DISPATCH] Sent to ${mailOptions.to} via Port 587 STARTTLS (id: ${info.messageId})`);
    return { sent: true, method: 'smtp_587', messageId: info.messageId };
  } catch (err587) {
    console.warn(`[EMAIL DISPATCH WARN] Port 587 STARTTLS failed (${err587.message}). Trying Gmail Service fallback...`);
  }

  // Attempt 3: Gmail Service
  try {
    const transporterService = createServiceTransporter();
    const info = await transporterService.sendMail(mailOptions);
    console.log(`[EMAIL DISPATCH] Sent to ${mailOptions.to} via Gmail Service (id: ${info.messageId})`);
    return { sent: true, method: 'gmail_service', messageId: info.messageId };
  } catch (errService) {
    console.error(`[EMAIL DISPATCH ERROR] All direct SMTP transports failed for ${mailOptions.to}: ${errService.message}`);
    return { sent: false, error: errService.message };
  }
}

// Backward-compatible transporter getter
function getEmailTransporter() {
  return createSslTransporter();
}

// Reset codes file persistence path
const RESET_CODES_FILE = path.join(__dirname, 'data', 'reset-codes.json');

function loadResetCodes() {
  try {
    if (fs.existsSync(RESET_CODES_FILE)) {
      const raw = fs.readFileSync(RESET_CODES_FILE, 'utf8');
      const data = JSON.parse(raw);
      const now = Date.now();
      const map = new Map();
      for (const [c, entry] of Object.entries(data)) {
        if (entry && entry.expiresAt > now) {
          map.set(c, entry);
        }
      }
      return map;
    }
  } catch (e) {
    console.warn('[RESET CODES] Error loading reset codes file:', e.message);
  }
  return new Map();
}

function saveResetCodes(map) {
  try {
    const obj = {};
    for (const [c, entry] of map.entries()) {
      obj[c] = entry;
    }
    fs.writeFileSync(RESET_CODES_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('[RESET CODES] Error saving reset codes file:', e.message);
  }
}

// In-memory verification code store (code -> { email, expiresAt }) backed by file persistence
const activeResetCodes = loadResetCodes();
let lastCodeSentTimestamp = 0;

/**
 * Dispatches reset email via Netlify serverless function
 * (bypasses cloud host SMTP port blocking on Render)
 */
async function sendViaNetlifyFunction(toEmail, code) {
  const netlifyUrl = 'https://quad-ace-herbs.netlify.app/.netlify/functions/send-reset-email';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(netlifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail, code }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await response.json();
    if (response.ok && data.success) {
      console.log(`[EMAIL] Reset code sent via Netlify Serverless Function to ${toEmail}`);
      return { sent: true, method: 'netlify_function' };
    } else {
      console.warn(`[EMAIL WARN] Netlify function returned error:`, data);
      return { sent: false, error: data.error || data.message };
    }
  } catch (err) {
    console.warn(`[EMAIL WARN] Netlify dispatch failed:`, err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Dispatches order notifications via HTTPS Netlify Serverless Relay
 * (Bypasses Render's firewall block on SMTP ports 25, 465, and 587)
 */
async function sendOrderViaNetlifyRelay(orderData, isCustomer = false) {
  const netlifyUrl = 'https://quad-ace-herbs.netlify.app/.netlify/functions/notify-email';
  try {
    const payload = {
      ...orderData,
      isCustomerConfirmation: isCustomer,
      action: isCustomer ? 'customer_payment_confirmed' : 'new_order'
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(netlifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);

    const data = await response.json();
    if (response.ok && data.success) {
      console.log(`[NETLIFY RELAY] Delivered ${isCustomer ? 'customer receipt' : 'owner alert'} for order ${orderData.orderRef}`);
      return { sent: true, method: 'netlify_https_relay', data };
    } else {
      console.warn(`[NETLIFY RELAY WARN] Relay returned:`, data);
      return { sent: false, error: data.error || data.message };
    }
  } catch (err) {
    console.warn(`[NETLIFY RELAY ERROR] Relay dispatch failed:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendResetEmail(toEmail, code) {
  // Try Netlify HTTPS function first (bypasses Render port 465/587 blocking)
  const netlifyRes = await sendViaNetlifyFunction(toEmail, code);
  if (netlifyRes.sent) return netlifyRes;

  const LOGO_PATH = path.join(__dirname, 'images', 'aduke-alagbo-logo.jpeg');
  const hasLogo = fs.existsSync(LOGO_PATH);

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        ${hasLogo ? `<img src="cid:adukeAlagboLogo" alt="Aduke Alagbo Logo" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2.5px solid #d4af37; box-shadow: 0 4px 10px rgba(0,0,0,0.15); display: block; margin: 0 auto 10px;">` : ''}
        <h2 style="color: #18422e; margin: 0; font-size: 22px; font-weight: 800;">Aduke Alagbo</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Admin Security & Password Reset</p>
      </div>
      <p style="color: #1e293b; font-size: 15px;">Hello Store Owner,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        We received a request to reset your admin dashboard passcode. Enter the following 6-digit verification code on your screen to set your new password:
      </p>
      <div style="background: #f4efe4; border: 1.5px solid #d4af37; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #18422e; font-family: monospace;">${code}</div>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.4;">
        ⏳ <strong>Note:</strong> This verification code is valid for <strong>15 minutes</strong>. If you did not request this password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">Aduke Alagbo • Authentic Ancestral Remedies • Abeokuta, Ogun State, Nigeria</p>
    </div>
  `;

  const emailAttachments = hasLogo ? [
    {
      filename: 'aduke-alagbo-logo.jpeg',
      path: LOGO_PATH,
      cid: 'adukeAlagboLogo'
    }
  ] : [];

  const mailOptions = {
    from: `"Aduke Alagbo Security" <${SMTP_USER}>`,
    to: toEmail,
    subject: "Your Aduke Alagbo Admin Password Reset Code",
    html: htmlContent,
    attachments: emailAttachments
  };

  const dispatchResult = await sendMailWithFallback(mailOptions);
  if (dispatchResult.sent) {
    console.log(`[EMAIL] Verification code successfully sent to ${toEmail} via ${dispatchResult.method}`);
    return { sent: true, method: dispatchResult.method };
  }

  // Graceful simulation log in console for development/offline testing
  console.log('\n======================================================');
  console.log(`✉️ [EMAIL SENT TO OWNER (SIMULATED)]`);
  console.log(`📬 To: ${toEmail}`);
  console.log(`🔑 6-Digit Verification Code: ${code}`);
  console.log(`⏳ Valid for: 15 minutes`);
  console.log('======================================================\n');
  return { sent: false, method: 'simulated' };
}

// Note: Buyer confirmation email is strictly deferred until admin verifies payment in dashboard.

// --- STORE OWNER ORDER ALERT SENDER ---
async function sendOwnerOrderAlert(orderData, ownerEmail) {
  const targetEmail = (ownerEmail || DEFAULT_OWNER_EMAIL).trim();

  // 1. Prioritize Netlify HTTPS Serverless Relay (bypasses Render SMTP port blocking)
  const relayRes = await sendOrderViaNetlifyRelay({ ...orderData, ownerEmail: targetEmail }, false);
  if (relayRes.sent) {
    console.log(`[ORDER OWNER ALERT] Notification delivered to ${targetEmail} via Netlify HTTPS relay`);
    return relayRes;
  }

  const LOGO_PATH = path.join(__dirname, 'images', 'aduke-alagbo-logo.jpeg');
  const hasLogo = fs.existsSync(LOGO_PATH);

  const itemsRows = (orderData.items || []).map((it, idx) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        <strong>${idx + 1}. ${it.name}</strong>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: center; color: #475569;">
        x${it.quantity}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: 700; color: #18422e;">
        ₦${Number(it.price * it.quantity).toLocaleString('en-NG')}
      </td>
    </tr>
  `).join('');

  const deliveryNote = orderData.shippingMethod === 'nationwide'
    ? 'Interstate Courier (Sorted with dispatch rider)'
    : (orderData.shippingMethod === 'international' ? 'International DHL / FedEx (Sorted with courier)' : `Local Courier (₦${Number(orderData.shippingFee || 0).toLocaleString('en-NG')})`);

  const paymentLabel = orderData.paymentMethod === 'bank' ? 'Direct Bank Transfer (Kuda Bank)' : 'WhatsApp Direct Order';
  const custPhoneClean = (orderData.customer && orderData.customer.phone) ? orderData.customer.phone.replace(/[^0-9+]/g, '') : '';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <!-- Brand Header -->
      <div style="background: linear-gradient(135deg, #102e20 0%, #18422e 100%); padding: 26px 20px; text-align: center; color: #ffffff;">
        ${hasLogo ? `<img src="cid:adukeAlagboLogo" alt="Aduke Alagbo Logo" style="width: 78px; height: 78px; border-radius: 50%; object-fit: cover; border: 3px solid #d4af37; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: block; margin: 0 auto 10px;">` : ''}
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.02em; color: #ffffff;">Aduke Alagbo</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Official Store Order Notification</p>
      </div>

      <div style="padding: 24px;">
        <div style="background: #f8fafc; border-left: 4px solid #18422e; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
          <div style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700;">Order Reference</div>
          <div style="font-size: 20px; font-weight: 800; color: #18422e; font-family: monospace;">${orderData.orderRef}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Placed on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>

        <!-- Customer Delivery Details -->
        <h3 style="font-size: 14px; color: #18422e; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px;">
          Customer Delivery Information
        </h3>
        <table style="width: 100%; font-size: 14px; margin-bottom: 22px; line-height: 1.6;">
          <tr>
            <td style="color: #64748b; width: 140px; vertical-align: top;"><strong>Customer Name:</strong></td>
            <td style="color: #1e293b; font-weight: 700;">${orderData.customer ? orderData.customer.name : 'Customer'}</td>
          </tr>
          <tr>
            <td style="color: #64748b; vertical-align: top;"><strong>Phone / WhatsApp:</strong></td>
            <td style="color: #1e293b; font-weight: 700;">
              <a href="tel:${custPhoneClean}" style="color: #18422e; text-decoration: none;">${orderData.customer ? orderData.customer.phone : ''}</a>
              ${custPhoneClean ? ` &bull; <a href="https://wa.me/${custPhoneClean.replace(/^\+/, '')}" style="color: #15803d; text-decoration: underline; font-size: 12px;">Chat on WhatsApp</a>` : ''}
            </td>
          </tr>
          <tr>
            <td style="color: #64748b; vertical-align: top;"><strong>Email:</strong></td>
            <td style="color: #1e293b;">
              ${(orderData.customer && orderData.customer.email) ? `<a href="mailto:${orderData.customer.email}" style="color: #18422e;">${orderData.customer.email}</a>` : 'Not provided'}
            </td>
          </tr>
          <tr>
            <td style="color: #64748b; vertical-align: top;"><strong>Delivery Address:</strong></td>
            <td style="color: #1e293b;">${(orderData.customer && orderData.customer.address) || 'Not provided'}</td>
          </tr>
          ${orderData.customer && orderData.customer.notes ? `
          <tr>
            <td style="color: #64748b; vertical-align: top;"><strong>Special Notes:</strong></td>
            <td style="color: #b45309; font-style: italic;">${orderData.customer.notes}</td>
          </tr>
          ` : ''}
        </table>

        <!-- Ordered Items Table -->
        <h3 style="font-size: 14px; color: #18422e; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px;">
          Items Ordered
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #475569; text-transform: uppercase;">Product</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 12px; color: #475569; text-transform: uppercase;">Qty</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #475569; text-transform: uppercase;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Total Calculation -->
        <div style="background: #f8fafc; padding: 14px 18px; border-radius: 8px; margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 4px;">
            <span>Subtotal:</span>
            <span>₦${Number(orderData.subtotal || 0).toLocaleString('en-NG')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 4px;">
            <span>Delivery Zone:</span>
            <span>${deliveryNote}</span>
          </div>
          ${orderData.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #15803d; margin-bottom: 4px;">
            <span>Discount:</span>
            <span>-₦${Number(orderData.discount).toLocaleString('en-NG')}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 17px; font-weight: 800; color: #18422e; border-top: 1.5px dashed #cbd5e1; padding-top: 8px; margin-top: 6px;">
            <span>Total Amount Due:</span>
            <span style="color: #15803d;">₦${Number(orderData.finalTotal || 0).toLocaleString('en-NG')}</span>
          </div>
        </div>

        <!-- Payment Info & Verification Notice -->
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 4px;">
            Payment Method: ${paymentLabel}
          </div>
          ${(orderData.senderDetails && (orderData.senderDetails.bank || orderData.senderDetails.name || orderData.senderDetails.sessionId)) ? `
          <div style="font-size: 13px; color: #1e293b; margin: 8px 0; line-height: 1.5;">
            ${orderData.senderDetails.bank ? `<div>• <strong>Customer Bank:</strong> ${orderData.senderDetails.bank}</div>` : ''}
            ${orderData.senderDetails.name ? `<div>• <strong>Sender Name:</strong> ${orderData.senderDetails.name}</div>` : ''}
            ${orderData.senderDetails.sessionId ? `<div>• <strong>Session ID / Ref:</strong> ${orderData.senderDetails.sessionId}</div>` : ''}
          </div>
          ` : ''}
          <div style="font-size: 12px; color: #15803d; line-height: 1.5; margin-top: 6px;">
            ${orderData.paymentMethod === 'bank'
              ? '<strong>Action Required:</strong> Check your instant Kuda Bank alert to verify credit of ₦' + Number(orderData.finalTotal || 0).toLocaleString('en-NG') + ' before dispatching package.'
              : 'Customer selected direct WhatsApp order confirmation.'}
          </div>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Aduke Alagbo • Authentic Ancestral Remedies • Abeokuta, Ogun State, Nigeria
        </p>
      </div>
    </div>
  `;

  const emailAttachments = hasLogo ? [
    {
      filename: 'aduke-alagbo-logo.jpeg',
      path: LOGO_PATH,
      cid: 'adukeAlagboLogo'
    }
  ] : [];

  if (orderData.receiptProof && orderData.receiptProof.dataUrl && orderData.receiptProof.dataUrl.startsWith('data:image')) {
    const matches = orderData.receiptProof.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      emailAttachments.push({
        filename: orderData.receiptProof.fileName || 'customer-transfer-receipt.jpg',
        content: Buffer.from(matches[2], 'base64'),
        contentType: matches[1]
      });
    }
  }

  const subject = `🌿 New Order: ${orderData.customer ? orderData.customer.name : 'Customer'} (${orderData.orderRef}) - Aduke Alagbo`;

  const mailOptions = {
    from: `"Aduke Alagbo Store" <${SMTP_USER}>`,
    to: targetEmail,
    subject: subject,
    html: htmlContent,
    attachments: emailAttachments
  };

  const dispatchResult = await sendMailWithFallback(mailOptions);
  if (dispatchResult.sent) {
    console.log(`[ORDER OWNER ALERT] Notification delivered to ${targetEmail} via ${dispatchResult.method}`);
    return { sent: true, method: dispatchResult.method };
  }

  return { sent: false, error: dispatchResult.error };
}

// In-memory deduplication map (orderRef -> timestamp)
const recentlyNotifiedOrders = new Map();

// --- MASTER ORDER NOTIFICATION DISPATCHER ---
// Sends alert email EXCLUSIVELY to the store owner (admin)
// The buyer receives NO email at checkout. Buyer receives confirmation ONLY after admin confirms in the dashboard.
async function sendOrderNotificationEmail(orderData) {
  if (!orderData || !orderData.orderRef) {
    return { sent: false, message: 'Invalid order data' };
  }

  // Strictly skip email dispatch if this is a sync, replay, or background backup push
  if (orderData.isSync || orderData.skipEmail) {
    console.log(`[ORDER NOTIFY] Skipping sync/backup order ${orderData.orderRef} - no email required.`);
    return { sent: false, skippedSync: true, orderRef: orderData.orderRef };
  }

  const cleanRef = (orderData.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const now = Date.now();

  // Deduplication guard: ignore duplicate calls for the same order within 30 seconds
  if (recentlyNotifiedOrders.has(cleanRef)) {
    const lastSent = recentlyNotifiedOrders.get(cleanRef);
    if (now - lastSent < 30000) {
      console.log(`[ORDER NOTIFY] Order ${orderData.orderRef} owner alert already notified within last 30s. Skipping duplicate.`);
      return { sent: true, skippedDuplicate: true, orderRef: orderData.orderRef };
    }
  }
  recentlyNotifiedOrders.set(cleanRef, now);

  const auth = getAuthData();
  const ownerEmail = (auth && auth.adminEmail) ? auth.adminEmail : DEFAULT_OWNER_EMAIL;

  console.log(`[ORDER DISPATCH] Sending admin order alert for order ${orderData.orderRef}...`);
  console.log(`[ORDER DISPATCH] Store Owner: ${ownerEmail}`);
  console.log(`[ORDER DISPATCH] (Buyer email held until admin confirms payment in dashboard)`);

  const ownerResult = await sendOwnerOrderAlert(orderData, ownerEmail);
  const ownerSent = Boolean(ownerResult && ownerResult.sent);

  console.log(`[ORDER DISPATCH RESULT] ${orderData.orderRef} -> Owner Alert: ${ownerSent ? 'DELIVERED ✓' : 'FAILED ✗'}, Buyer Email: HELD_UNTIL_ADMIN_CONFIRMATION`);

  return {
    sent: ownerSent,
    ownerEmailSent: ownerSent,
    customerEmailSent: false,
    ownerResult
  };
}

// --- INITIALIZE AUTH STORAGE ---
function getAuthData() {
  if (!fs.existsSync(AUTH_FILE)) {
    const initialData = {
      passwordHash: hashSecret(DEFAULT_INITIAL_PASSWORD),
      adminEmail: process.env.ADMIN_EMAIL || DEFAULT_OWNER_EMAIL,
      isDefaultPassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    console.log('\n======================================================');
    console.log('🌿 Aduke Alagbo Admin Security Initialized');
    console.log(`🔐 Default Admin Password: ${DEFAULT_INITIAL_PASSWORD}`);
    console.log(`✉️ Registered Owner Email: ${initialData.adminEmail}`);
    console.log('======================================================\n');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.adminEmail || data.adminEmail === "seller@adukealagbo.com") {
      data.adminEmail = process.env.ADMIN_EMAIL || DEFAULT_OWNER_EMAIL;
      saveAuthData(data);
    }
    return data;
  } catch (err) {
    console.error('Error reading auth file, re-initializing:', err);
    return null;
  }
}

function saveAuthData(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Ensure auth file exists on startup
getAuthData();

// --- AUTHENTICATION API ENDPOINTS ---

/**
 * GET /api/auth/status
 * Check if backend is active, default password status, and masked owner email
 */
app.get('/api/auth/status', (req, res) => {
  const auth = getAuthData();
  const email = auth ? auth.adminEmail : DEFAULT_OWNER_EMAIL;
  res.json({
    active: true,
    isDefaultPassword: auth ? !!auth.isDefaultPassword : false,
    maskedEmail: maskEmail(email)
  });
});

/**
 * POST /api/auth/login
 * Verify entered password against encrypted hash with rate limiting
 */
app.post('/api/auth/login', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Please wait ${rateLimitStatus.retryAfterSec} seconds before trying again.`
    });
  }

  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  const auth = getAuthData();
  if (!auth) {
    return res.status(500).json({ success: false, message: 'Server auth data unavailable' });
  }

  // Cryptographically verify secret against scrypt hash
  let isValid = verifySecret(password, auth.passwordHash);

  // If store is still using default factory state, check default initial password
  if (!isValid && auth.isDefaultPassword && password === DEFAULT_INITIAL_PASSWORD) {
    isValid = true;
  }

  if (!isValid) {
    recordFailedLogin(clientIp);
    return res.status(401).json({ success: false, message: 'Incorrect admin passcode' });
  }

  clearLoginAttempts(clientIp);
  const token = createSession();
  res.json({
    success: true,
    token,
    isDefaultPassword: !!auth.isDefaultPassword,
    message: 'Authentication successful'
  });
});

/**
 * POST /api/auth/logout
 * Invalidate active admin session token
 */
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '').trim() : null;
  if (token && activeSessions.has(token)) {
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/auth/change-password
 * Change password when current password is known or with valid active session
 */
app.post('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '').trim() : null;

  const auth = getAuthData();
  if (!auth) {
    return res.status(500).json({ success: false, message: 'Auth data unavailable' });
  }

  let isAuthorized = false;
  if (token && isValidSession(token)) {
    isAuthorized = true;
  } else if (currentPassword && typeof currentPassword === 'string') {
    if (verifySecret(currentPassword, auth.passwordHash)) {
      isAuthorized = true;
    } else if (auth.isDefaultPassword && currentPassword === DEFAULT_INITIAL_PASSWORD) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Current passcode is incorrect' });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New passcode must be at least 8 characters long for security'
    });
  }

  auth.passwordHash = hashSecret(newPassword.trim());
  auth.isDefaultPassword = false;
  saveAuthData(auth);

  const newToken = createSession();
  console.log(`[AUTH] Admin password updated successfully at ${new Date().toISOString()}`);

  res.json({
    success: true,
    token: newToken,
    message: 'Admin passcode updated successfully! Your new password is now active.'
  });
});

/**
 * POST /api/auth/send-reset-code
 * Sends a 6-digit reset code to the owner's email
 */
app.post('/api/auth/send-reset-code', async (req, res) => {
  // Prevent excessive spam (at least 20 seconds between code requests)
  const now = Date.now();
  if (now - lastCodeSentTimestamp < 20000) {
    return res.status(429).json({
      success: false,
      message: 'Please wait a few seconds before requesting another code.'
    });
  }

  const auth = getAuthData();
  const ownerEmail = auth ? auth.adminEmail : DEFAULT_OWNER_EMAIL;

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + 15 * 60 * 1000; // 15 minutes

  activeResetCodes.set(code, {
    email: ownerEmail,
    expiresAt: expiresAt
  });
  saveResetCodes(activeResetCodes);
  lastCodeSentTimestamp = now;

  try {
    const result = await sendResetEmail(ownerEmail, code);
    if (result.sent) {
      res.json({
        success: true,
        sent: true,
        message: `A 6-digit verification code has been sent directly to your Gmail inbox (${maskEmail(ownerEmail)}). Check your inbox and spam folder!`,
        maskedEmail: maskEmail(ownerEmail)
      });
    } else if (result.method === 'simulated') {
      res.json({
        success: true,
        sent: false,
        simulated: true,
        message: `[Development Notice] Real Gmail sending requires a Gmail App Password in .env. We've logged your 6-digit code in the server terminal, or configure .env to deliver directly to ${maskEmail(ownerEmail)}.`,
        maskedEmail: maskEmail(ownerEmail)
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Email sending failed: ${result.error || 'SMTP Error'}. Please check your Gmail App Password in .env.`
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to send verification email. Please try again.'
    });
  }
});

/**
 * POST /api/auth/verify-reset-code
 * Verifies the 6-digit email code and updates the password
 */
app.post('/api/auth/verify-reset-code', (req, res) => {
  const { code, newPassword } = req.body;

  if (!code || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Verification code and new passcode are both required'
    });
  }

  const cleanCode = code.toString().trim();
  const currentCodes = loadResetCodes();
  const record = currentCodes.get(cleanCode) || activeResetCodes.get(cleanCode);

  if (!record) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code. Please check your email or request a new code.'
    });
  }

  if (Date.now() > record.expiresAt) {
    activeResetCodes.delete(cleanCode);
    currentCodes.delete(cleanCode);
    saveResetCodes(currentCodes);
    return res.status(400).json({
      success: false,
      message: 'This verification code has expired. Please request a fresh code.'
    });
  }

  if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New passcode must be at least 8 characters long for security'
    });
  }

  const auth = getAuthData();
  auth.passwordHash = hashSecret(newPassword.trim());
  auth.isDefaultPassword = false;
  saveAuthData(auth);

  // Consume code so it cannot be used again
  activeResetCodes.delete(cleanCode);
  currentCodes.delete(cleanCode);
  saveResetCodes(currentCodes);

  const newToken = createSession();
  console.log(`[AUTH] Admin password was successfully reset via email OTP at ${new Date().toISOString()}`);

  res.json({
    success: true,
    token: newToken,
    message: 'Admin passcode reset successfully! You are now logged in.'
  });
});

/**
 * POST /api/auth/emergency-reset
 * Emergency password reset using server-side ADMIN_MASTER_KEY environment secret
 */
app.post('/api/auth/emergency-reset', (req, res) => {
  const { masterKey, newPassword } = req.body || {};
  const serverMasterKey = process.env.ADMIN_MASTER_KEY;

  if (!serverMasterKey) {
    return res.status(503).json({
      success: false,
      message: 'Master Key reset is disabled because ADMIN_MASTER_KEY is not configured on the server. Please reset your passcode via Email Verification Code.'
    });
  }

  if (!masterKey || typeof masterKey !== 'string' || masterKey.trim() !== serverMasterKey.trim()) {
    return res.status(401).json({
      success: false,
      message: 'Invalid Master Recovery Key. Access denied.'
    });
  }

  if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New passcode must be at least 8 characters long for security'
    });
  }

  const auth = getAuthData();
  auth.passwordHash = hashSecret(newPassword.trim());
  auth.isDefaultPassword = false;
  auth.updatedAt = new Date().toISOString();
  saveAuthData(auth);

  db.setAdminPassword(newPassword.trim()).catch(e => console.warn('[DB MASTER RESET WARN]', e.message));

  const newToken = createSession();
  console.log(`[AUTH] Admin password reset via Master Recovery Key at ${new Date().toISOString()}`);

  res.json({
    success: true,
    token: newToken,
    message: 'Passcode reset successfully via Master Recovery Key! You are now logged in.'
  });
});

/**
 * GET /api/auth/email
 * Get registered recovery email (requires session token)
 */
app.get('/api/auth/email', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : null;

  if (!isValidSession(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const auth = getAuthData();
  res.json({
    success: true,
    email: auth.adminEmail || DEFAULT_OWNER_EMAIL,
    maskedEmail: maskEmail(auth.adminEmail || DEFAULT_OWNER_EMAIL)
  });
});

/**
 * POST /api/auth/update-email
 * Update registered recovery email (requires session token)
 */
app.post('/api/auth/update-email', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : null;

  if (!isValidSession(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { newEmail } = req.body;
  if (!newEmail || !newEmail.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email address is required' });
  }

  const auth = getAuthData();
  auth.adminEmail = newEmail.trim().toLowerCase();
  saveAuthData(auth);

  res.json({
    success: true,
    email: auth.adminEmail,
    message: 'Recovery email updated successfully! Future password resets will be sent to this email.'
  });
});

// --- PRODUCT CATALOG API ENDPOINTS ---

function getCustomProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveCustomProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

/**
 * GET /api/products
 * Get all custom products and deleted product IDs stored on server
 */
app.get('/api/products', (req, res) => {
  const products = getCustomProducts();
  const deletedProductIds = getDeletedProducts();
  res.json({ success: true, products, deletedProductIds });
});

/**
 * POST /api/products
 * Save a new or edited product (Admin Only)
 */
app.post('/api/products', requireAdminAuth, (req, res) => {
  const product = req.body;
  if (!product || !product.id || !product.name) {
    return res.status(400).json({ success: false, message: 'Invalid product data' });
  }

  unmarkDeletedProduct(product.id);

  const products = getCustomProducts();
  const existingIdx = products.findIndex(p => p.id === product.id);
  if (existingIdx >= 0) {
    products[existingIdx] = product;
  } else {
    products.unshift(product);
  }

  saveCustomProducts(products);
  res.json({ success: true, product, deletedProductIds: getDeletedProducts(), message: 'Product saved on server' });
});

/**
 * DELETE /api/products/:id
 * Remove a product (Admin Only)
 */
app.delete('/api/products/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  let products = getCustomProducts();
  products = products.filter(p => p.id !== id);
  saveCustomProducts(products);
  recordDeletedProduct(id);
  res.json({ success: true, message: 'Product deleted from server', deletedId: id, deletedProductIds: getDeletedProducts() });
});

// --- CATEGORIES API ENDPOINTS ---
function getCustomCategories() {
  try {
    if (fs.existsSync(CATEGORIES_FILE)) {
      const raw = fs.readFileSync(CATEGORIES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[SERVER] Could not read categories file:', err.message);
  }
  return [];
}

function saveCustomCategories(categories) {
  try {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[SERVER] Could not save categories:', err.message);
    return false;
  }
}

/**
 * GET /api/categories
 * Retrieve all custom categories and deleted category IDs stored on server
 */
app.get('/api/categories', (req, res) => {
  const categories = getCustomCategories();
  const deletedCategoryIds = getDeletedCategories();
  res.json({ success: true, categories, deletedCategoryIds });
});

/**
 * POST /api/categories
 * Add or update a category (Admin Only)
 */
app.post('/api/categories', requireAdminAuth, (req, res) => {
  const cat = req.body;
  if (!cat || (!cat.name && !cat.label)) {
    return res.status(400).json({ success: false, message: 'Invalid category data' });
  }

  const label = (cat.label || cat.name).trim();
  const id = cat.id || ('cat-' + label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now().toString().slice(-4));
  unmarkDeletedCategory(id);

  const newCat = {
    id,
    label,
    icon: (cat.icon || '🌿').trim(),
    desc: (cat.desc || '').trim(),
    isCustom: true,
    createdAt: cat.createdAt || new Date().toISOString()
  };

  const categories = getCustomCategories();
  const existingIdx = categories.findIndex(c => c.id === id);
  if (existingIdx >= 0) {
    categories[existingIdx] = newCat;
  } else {
    categories.push(newCat);
  }

  saveCustomCategories(categories);
  res.json({ success: true, category: newCat, deletedCategoryIds: getDeletedCategories(), message: 'Category saved on server' });
});

/**
 * DELETE /api/categories/:id
 * Remove a custom category (Admin Only)
 */
app.delete('/api/categories/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  let categories = getCustomCategories();
  categories = categories.filter(c => c.id !== id);
  saveCustomCategories(categories);
  recordDeletedCategory(id);
  res.json({ success: true, message: 'Category deleted from server', deletedId: id, deletedCategoryIds: getDeletedCategories() });
});

// --- CUSTOMER REVIEWS API ENDPOINTS ---

const DEFAULT_REVIEWS = [
  {
    id: "rev-1",
    name: "Olumide B.",
    location: "Lekki, Lagos",
    rating: 5,
    remedy: "Agbo Jedi-Jedi Extra Strength",
    comment: "I had suffered from severe Jedi-Jedi and lower back pain for over 8 months. Sitting in traffic was pure torture. After just 4 days of taking Aduke Alagbo Agbo Jedi Extra Strength, the waist stiffness completely dissolved. This is the real deal!",
    verifiedBuyer: true,
    createdAt: "2026-09-28T10:30:00.000Z"
  },
  {
    id: "rev-2",
    name: "Chinedu E.",
    location: "Abuja, FCT",
    rating: 5,
    remedy: "Man-Power Virility Roots",
    comment: "The Man-Power Stamina roots are incredible. No strange chemical headaches or rapid heartbeats like the synthetic pills sold in pharmacies. Just pure, natural, energetic power and lasting confidence. My wife noticed the difference immediately.",
    verifiedBuyer: true,
    createdAt: "2026-10-01T14:15:00.000Z"
  },
  {
    id: "rev-3",
    name: "Amina K.",
    location: "London, United Kingdom",
    rating: 5,
    remedy: "Queen's Hormonal Balance",
    comment: "I ordered the Queen's Hormonal Balance tea from the UK via DHL. It arrived in London in just 4 days! My cycle that had seized for 3 months returned naturally with zero pain. God bless Aduke Alagbo!",
    verifiedBuyer: true,
    createdAt: "2026-10-04T09:45:00.000Z"
  },
  {
    id: "rev-4",
    name: "Folashade A.",
    location: "Ibadan, Oyo State",
    rating: 5,
    remedy: "Raw Prekese & Roots Bundle",
    comment: "The Bitter Kola & Prekese pod infusion cleared my morning fatigue and bloating within a week. Authentic herbs, properly prepared. Aduke Alagbo is now my family's go-to apothecary.",
    verifiedBuyer: true,
    createdAt: "2026-10-06T16:20:00.000Z"
  }
];

function getStoredReviews() {
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(DEFAULT_REVIEWS, null, 2), 'utf-8');
    return DEFAULT_REVIEWS;
  }
  try {
    const raw = fs.readFileSync(REVIEWS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REVIEWS;
  } catch (e) {
    return DEFAULT_REVIEWS;
  }
}

function saveStoredReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf-8');
}

/**
 * GET /api/reviews
 * Get all customer reviews (default + customer submitted)
 */
app.get('/api/reviews', async (req, res) => {
  const reviews = await db.getReviews();
  res.json({ success: true, reviews });
});

/**
 * POST /api/reviews
 * Submit a customer review (after purchase or from landing page)
 */
app.post('/api/reviews', async (req, res) => {
  const { name, location, rating, remedy, comment, verifiedBuyer } = req.body;
  if (!name || !name.trim() || !comment || !comment.trim()) {
    return res.status(400).json({ success: false, message: 'Name and comment are required.' });
  }

  // Safety protection: truncate fields so comments cannot bloat storage
  const safeName = name.trim().slice(0, 80);
  const safeLocation = (location && location.trim()) ? location.trim().slice(0, 80) : 'Abeokuta, Nigeria';
  const safeRemedy = (remedy && remedy.trim()) ? remedy.trim().slice(0, 100) : 'Authentic Herbal Remedy';
  const safeComment = comment.trim().slice(0, 1000); // Max 1,000 characters per comment

  const newReview = {
    id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: safeName,
    location: safeLocation,
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    remedy: safeRemedy,
    comment: safeComment,
    verifiedBuyer: verifiedBuyer !== false,
    createdAt: new Date().toISOString()
  };

  const saved = await db.saveReview(newReview);
  console.log(`[REVIEW] New customer review posted by ${newReview.name} for ${newReview.remedy}`);
  res.json({ success: true, review: saved, message: 'Review successfully saved and published on the website!' });
});

/**
 * DELETE /api/reviews/:id
 * Remove a review (admin moderation - Admin Only)
 */
app.delete('/api/reviews/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  await db.deleteReview(id);
  const remaining = await db.getReviews();
  res.json({ success: true, message: 'Review removed successfully.', reviews: remaining });
});

// --- ORDER EMAIL NOTIFICATION ENDPOINT ---
/**
 * POST /api/orders/notify-email
 * Send rich HTML order confirmation email to store owner with embedded brand logo
 */
app.post('/api/orders/notify-email', async (req, res) => {
  const orderData = req.body;
  if (!orderData || !orderData.orderRef) {
    return res.status(400).json({ success: false, message: 'Invalid order data' });
  }

  // Also ensure order is persisted in server orders database
  let saved = null;
  try {
    saved = saveNewServerOrder(orderData);
  } catch (e) {
    console.warn('[SERVER] Could not auto-persist order on email notify:', e.message);
  }

  const isSync = Boolean(req.body.isSync || req.body.skipEmail);
  const isProcessed = saved && saved.status && saved.status !== 'pending';
  const alreadySent = Boolean(saved && saved.adminAlertEmailSent);

  if (isSync || isProcessed || alreadySent) {
    console.log(`[NOTIFY-EMAIL API] Skipping duplicate or sync email for ${orderData.orderRef}`);
    return res.json({ success: true, skippedDuplicate: true, message: 'Duplicate or sync order email skipped.' });
  }

  if (saved) {
    saved.adminAlertEmailSent = true;
    saveStoredOrders(getStoredOrders());
  }

  try {
    const result = await sendOrderNotificationEmail(orderData);
    res.json({ success: true, result, message: 'Order email notification dispatched with brand logo.' });
  } catch (err) {
    console.error('[ORDER EMAIL API ERROR]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- CUSTOMER ORDERS & PURCHASES API ENDPOINTS ---

const DEFAULT_SERVER_ORDERS = [
  {
    orderRef: "#QA-84920",
    customer: {
      name: "Mrs. Funmilayo Adeleke",
      phone: "+234 803 456 7891",
      email: "funmi.adeleke@gmail.com",
      address: "Block 4, Flat 2, Admiralty Way, Lekki Phase 1, Lagos State",
      notes: "Please call my security gate on arrival. Deliver before 3 PM if possible."
    },
    senderDetails: {
      bank: "GTBank",
      name: "Funmilayo Adeleke",
      sessionId: "00001324090543219"
    },
    receiptProof: {
      hasReceipt: true,
      fileName: "gtbank_transfer_receipt.jpg",
      dataUrl: "images/agbo-jedi.jpg",
      sessionId: "00001324090543219"
    },
    items: [
      {
        id: "agbo-jedi-extra",
        name: "Agbo Jedi-Jedi Extra Strength",
        price: 6500,
        quantity: 2,
        image: "images/agbo-jedi.jpg",
        category: "agbo"
      },
      {
        id: "raw-ancestral-roots",
        name: "Raw Ancestral Boiling Roots Bundle (Gbogbonise)",
        price: 5500,
        quantity: 1,
        image: "images/ancestral-roots.jpg",
        category: "raw"
      }
    ],
    shippingMethod: "nationwide",
    shippingFee: 0,
    discount: 0,
    subtotal: 18500,
    finalTotal: 18500,
    paymentMethod: "bank",
    status: "verified",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), note: "Customer submitted bank transfer proof" },
      { status: "verified", timestamp: new Date(Date.now() - 100 * 60 * 1000).toISOString(), note: "Admin verified Kuda Bank transfer alert of ₦18,500" }
    ]
  },
  {
    orderRef: "#QA-93014",
    customer: {
      name: "Alhaji Ibrahim Danjuma",
      phone: "+234 812 345 6789",
      email: "ibrahim.d@yahoo.com",
      address: "Plot 14, Gwarinpa Estate, 3rd Avenue, Abuja, FCT",
      notes: "Kindly double-seal the bottles securely for courier travel."
    },
    senderDetails: {
      bank: "Zenith Bank",
      name: "Ibrahim Danjuma",
      sessionId: "00002819384729103"
    },
    receiptProof: {
      hasReceipt: true,
      fileName: "zenith_transfer_receipt.jpg",
      dataUrl: "images/man-power.jpg",
      sessionId: "00002819384729103"
    },
    items: [
      {
        id: "man-power-vitality",
        name: "Man-Power Virility & Stamina Roots Infusion",
        price: 9500,
        quantity: 2,
        image: "images/man-power.jpg",
        category: "men"
      }
    ],
    shippingMethod: "nationwide",
    shippingFee: 0,
    discount: 0,
    subtotal: 19000,
    finalTotal: 19000,
    paymentMethod: "bank",
    status: "dispatched",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
      { status: "verified", timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
      { status: "dispatched", timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), note: "Handed over to interstate courier dispatch rider" }
    ]
  },
  {
    orderRef: "#QA-58291",
    customer: {
      name: "Dr. Folashade Babatunde",
      phone: "+234 902 112 3344",
      email: "dr.folashade@gmail.com",
      address: "12 Quarry Road, Ibara, Abeokuta, Ogun State",
      notes: "Local dispatch rider can deliver anytime today."
    },
    senderDetails: {
      bank: "Kuda Bank",
      name: "Folashade Babatunde",
      sessionId: "20239805230912"
    },
    receiptProof: {
      hasReceipt: true,
      fileName: "kuda_payment_proof.jpg",
      dataUrl: "images/hormonal-balance.jpg",
      sessionId: "20239805230912"
    },
    items: [
      {
        id: "queens-hormonal-balance",
        name: "Queen's Hormonal Balance & Womb Cleanse",
        price: 8500,
        quantity: 1,
        image: "images/hormonal-balance.jpg",
        category: "women"
      },
      {
        id: "agbo-idakole-blend",
        name: "Agbo Idakole Herbal Cleanser",
        price: 6000,
        quantity: 1,
        image: "images/agbo-jedi.jpg",
        category: "agbo"
      }
    ],
    shippingMethod: "local",
    shippingFee: 2500,
    discount: 0,
    subtotal: 14500,
    finalTotal: 17000,
    paymentMethod: "bank",
    status: "pending",
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), note: "Awaiting owner verification of Kuda Bank alert" }
    ]
  },
  {
    orderRef: "#QA-41908",
    customer: {
      name: "Emeka Okonkwo",
      phone: "+234 807 889 9112",
      email: "emeka.ok@outlook.com",
      address: "5 Commercial Avenue, Yaba, Lagos State",
      notes: "Purchased directly via WhatsApp customer inquiry."
    },
    senderDetails: {
      bank: "OPay",
      name: "Emeka Okonkwo",
      sessionId: "OPAY-77129031"
    },
    receiptProof: {
      hasReceipt: false
    },
    items: [
      {
        id: "man-power-vitality",
        name: "Man-Power Virility & Stamina Roots Infusion",
        price: 9500,
        quantity: 1,
        image: "images/man-power.jpg",
        category: "men"
      },
      {
        id: "agbo-jedi-extra",
        name: "Agbo Jedi-Jedi Extra Strength",
        price: 6500,
        quantity: 1,
        image: "images/agbo-jedi.jpg",
        category: "agbo"
      }
    ],
    shippingMethod: "nationwide",
    shippingFee: 0,
    discount: 0,
    subtotal: 16000,
    finalTotal: 16000,
    paymentMethod: "whatsapp",
    status: "delivered",
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
      { status: "verified", timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
      { status: "dispatched", timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
      { status: "delivered", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), note: "Delivered safely to customer in Yaba" }
    ]
  }
];

function getStoredOrders() {
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(DEFAULT_SERVER_ORDERS, null, 2), 'utf-8');
    return DEFAULT_SERVER_ORDERS;
  }
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SERVER_ORDERS;
  } catch (e) {
    return DEFAULT_SERVER_ORDERS;
  }
}

function saveStoredOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

function getStoredInventory() {
  if (!fs.existsSync(INVENTORY_FILE)) {
    const initial = {};
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(INVENTORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveStoredInventory(inv) {
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inv, null, 2), 'utf-8');
}

function saveNewServerOrder(order) {
  if (!order || !order.orderRef) return null;
  db.saveOrder(order);
  console.log(`[ORDER RECORDED] Order ${order.orderRef} registered for customer ${order.customer ? order.customer.name : 'Guest'}`);
  return order;
}

/**
 * GET /api/orders/status/:orderRef
 * Public sanitized status check for customer receipt verification modal
 * (Only returns status metadata for the queried reference, no PII)
 */
app.get('/api/orders/status/:orderRef', async (req, res) => {
  const { orderRef } = req.params;
  if (!orderRef || typeof orderRef !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid order reference is required' });
  }

  const cleanRef = orderRef.trim().replace(/^#/, '').toLowerCase();
  const orders = await db.getOrders();
  const target = orders.find(o => (o.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase() === cleanRef);

  if (!target) {
    return res.status(404).json({ success: false, message: 'Order reference not found' });
  }

  // Return strictly public status metadata - never leak other customer records or address
  res.json({
    success: true,
    orderRef: target.orderRef,
    status: target.status || 'pending',
    updatedAt: target.updatedAt || target.createdAt
  });
});

/**
 * GET /api/orders
 * Returns all recorded customer purchases (Admin Only - Requires Bearer Token)
 */
app.get('/api/orders', requireAdminAuth, async (req, res) => {
  const orders = await db.getOrders();
  const deletedOrderRefs = getDeletedOrders();
  res.json({ success: true, orders, deletedOrderRefs, sqlActive: db.isSqlActive() });
});

/**
 * POST /api/orders
 * Customer places an order on the website (Strictly Validated)
 */
app.post('/api/orders', async (req, res) => {
  const orderData = req.body;
  if (!orderData || !orderData.orderRef || typeof orderData.orderRef !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid order reference' });
  }

  // Prevent resurrection of deleted orders from stale client devices
  const cleanRef = (orderData.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  if (isOrderDeleted(cleanRef) || isOrderDeleted(orderData.orderRef)) {
    console.log(`[ORDER POST IGNORED] Order ${orderData.orderRef} was previously deleted by store owner; resurrection ignored.`);
    return res.json({ success: true, ignored: true, message: 'Order was previously deleted by store owner' });
  }

  // Validate customer information
  if (!orderData.customer || typeof orderData.customer !== 'object') {
    return res.status(400).json({ success: false, message: 'Customer information is required' });
  }

  const cust = orderData.customer;
  if (!cust.name || typeof cust.name !== 'string' || cust.name.trim().length === 0 || cust.name.length > 150) {
    return res.status(400).json({ success: false, message: 'Valid customer name is required (max 150 characters)' });
  }
  if (!cust.phone || typeof cust.phone !== 'string' || cust.phone.trim().length < 6 || cust.phone.length > 40) {
    return res.status(400).json({ success: false, message: 'Valid customer phone number is required' });
  }
  if (!cust.address || typeof cust.address !== 'string' || cust.address.trim().length === 0 || cust.address.length > 500) {
    return res.status(400).json({ success: false, message: 'Valid customer delivery address is required (max 500 characters)' });
  }

  // Validate items list
  if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
  }

  // Validate receipt payload if present (defense against malicious dataUrl DoS)
  if (orderData.receiptProof && orderData.receiptProof.dataUrl) {
    const dataUrl = orderData.receiptProof.dataUrl;
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      const isAllowedMime = dataUrl.startsWith('data:image/jpeg') || 
                            dataUrl.startsWith('data:image/png') || 
                            dataUrl.startsWith('data:image/webp');
      if (!isAllowedMime) {
        return res.status(400).json({ success: false, message: 'Attached receipt must be a JPEG, PNG, or WebP image' });
      }
      if (dataUrl.length > 8 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Receipt upload exceeds maximum 6MB size' });
      }
    }
  }

  // Sanitize monetary totals
  orderData.subtotal = Math.max(0, Number(orderData.subtotal) || 0);
  orderData.shippingFee = Math.max(0, Number(orderData.shippingFee) || 0);
  orderData.discount = Math.max(0, Number(orderData.discount) || 0);
  orderData.finalTotal = Math.max(0, Number(orderData.finalTotal) || 0);

  const saved = await db.saveOrder(orderData);

  // STRICT DUPLICATE PREVENTION:
  // Never send an order email alert if:
  // 1. It is a sync request from admin dashboard or background job (isSync || skipEmail)
  // 2. The order has already been verified, dispatched, or delivered
  // 3. An email alert for this order was already dispatched (saved.adminAlertEmailSent)
  const isSync = Boolean(req.body.isSync || req.body.skipEmail);
  const isProcessed = saved && saved.status && saved.status !== 'pending';
  const alreadySent = Boolean(saved && saved.adminAlertEmailSent);

  if (!isSync && !isProcessed && !alreadySent) {
    saved.adminAlertEmailSent = true;
    await db.saveOrder(saved);
    sendOrderNotificationEmail(orderData).catch(err => {
      console.warn(`[ORDER EMAIL BG ERROR]: ${err.message}`);
    });
  } else {
    console.log(`[ORDER POST] Skipping email for ${orderData.orderRef} (isSync=${isSync}, isProcessed=${isProcessed}, alreadySent=${alreadySent})`);
  }

  res.json({ success: true, order: saved, message: `Order ${orderData.orderRef} placed and recorded successfully!` });
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// In-memory deduplication map for buyer status emails (dedupeKey -> timestamp)
const recentlyConfirmedPayments = new Map();

// Helper to dispatch confirmation/status update email to customer
async function sendCustomerPaymentConfirmationEmail(orderData, forcedStatus = null, forcedNote = null) {
  if (!orderData || !orderData.customer || !orderData.customer.email) {
    return { sent: false, message: 'No customer email provided for this order' };
  }

  const cleanRef = (orderData.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const rawStatus = forcedStatus || orderData.status || 'verified';
  const status = String(rawStatus).toLowerCase().trim();
  const note = forcedNote || orderData.note || '';
  const dedupKey = `${cleanRef}:${status}`;
  const now = Date.now();

  const isCancelled = ['cancelled', 'canceled', 'cancel'].includes(status);
  const isDispatched = ['dispatched', 'dispatch', 'in_transit', 'intransit'].includes(status);
  const isDelivered = ['delivered', 'deliver', 'completed'].includes(status);

  // Deduplication guard: ignore duplicate calls for the same order and status within 15 seconds
  if (cleanRef && recentlyConfirmedPayments.has(dedupKey)) {
    const lastSent = recentlyConfirmedPayments.get(dedupKey);
    if (now - lastSent < 15000) {
      console.log(`[CUSTOMER STATUS EMAIL] Status (${status}) for ${orderData.orderRef} already sent within last 15s. Skipping duplicate.`);
      return { sent: true, skippedDuplicate: true, orderRef: orderData.orderRef, status };
    }
  }
  if (cleanRef) {
    recentlyConfirmedPayments.set(dedupKey, now);
  }

  const customerEmail = orderData.customer.email.trim();

  // 1. Prioritize Netlify HTTPS relay (bypasses Render SMTP port blocking)
  try {
    const netlifyUrl = 'https://quad-ace-herbs.netlify.app/.netlify/functions/customer-payment-confirmed-email';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const relayRes = await fetch(netlifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        orderData: { ...orderData, status },
        status,
        note
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const relayData = await relayRes.json();
    if (relayRes.ok && relayData.success) {
      console.log(`[CUSTOMER STATUS EMAIL] Delivered (${status}) to ${customerEmail} via Netlify HTTPS relay`);
      return { sent: true, method: 'netlify_https_relay', status };
    }
  } catch (err) {
    console.warn(`[CUSTOMER STATUS EMAIL] Netlify relay attempt:`, err.message);
  }

  const LOGO_PATH = path.join(__dirname, 'images', 'aduke-alagbo-logo.jpeg');
  const hasLogo = fs.existsSync(LOGO_PATH);
  const customerName = orderData.customer.name ? escapeHtml(orderData.customer.name) : 'Valued Customer';
  const finalTotal = Number(orderData.finalTotal || 0);

  const itemsRows = (orderData.items || []).map((it, idx) => `
    <tr>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        <strong>${idx + 1}. ${escapeHtml(it.name)}</strong>
      </td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: center; color: #475569;">
        x${it.quantity}
      </td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: 700; color: #18422e;">
        ₦${Number(it.price * it.quantity).toLocaleString('en-NG')}
      </td>
    </tr>
  `).join('');

  const deliveryNote = orderData.shippingMethod === 'nationwide'
    ? 'Interstate Courier (Sorted with dispatch rider)'
    : (orderData.shippingMethod === 'international' ? 'International DHL / FedEx (Sorted with courier)' : `Local Courier (₦${Number(orderData.shippingFee || 0).toLocaleString('en-NG')})`);

  let emailSubject = '';
  let bannerHtml = '';
  let messageHtml = '';
  let badgeHtml = '';
  let totalsBottomHtml = '';
  let noticeBoxHtml = '';

  if (isCancelled) {
    emailSubject = `❌ Order Cancelled: Aduke Alagbo Order (${orderData.orderRef})`;
    bannerHtml = `
      <div style="background: #fef2f2; border-bottom: 2px solid #f87171; padding: 22px 24px; text-align: center;">
        <div style="display: inline-block; background: #dc2626; color: #ffffff; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; font-size: 20px; font-weight: bold; margin-bottom: 8px;">✕</div>
        <h2 style="margin: 0; font-size: 19px; color: #991b1b; font-weight: 800; letter-spacing: 0.02em;">ORDER CANCELLED</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #b91c1c;">Notice regarding order reference ${escapeHtml(orderData.orderRef)}</p>
      </div>
    `;
    messageHtml = `
      <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hello <strong>${customerName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Please be informed that your order <strong>${escapeHtml(orderData.orderRef)}</strong> has been <strong>cancelled</strong> by store administration and will not be prepared or shipped.
      </p>
      <div style="background: #fff1f2; border-left: 4px solid #e11d48; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #9f1239; text-transform: uppercase;">Reason / Administrative Note</div>
        <div style="font-size: 14px; color: #881337; margin-top: 4px;">
          ${note ? escapeHtml(note) : 'Payment was not received / confirmed within the payment window.'}
        </div>
      </div>
      <p style="color: #475569; font-size: 13px; line-height: 1.6;">
        <strong>Did you already transfer?</strong> If you already made a payment for this order, please message Aduke Alagbo immediately on WhatsApp with your transfer receipt so we can trace your payment and reinstate your order right away!
      </p>
    `;
    badgeHtml = `<span style="background: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; text-transform: uppercase;">Cancelled ❌</span>`;
    totalsBottomHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #991b1b;">
        <span>Order Status:</span>
        <span style="color: #dc2626;">Cancelled (Not Paid) ❌</span>
      </div>
    `;
    noticeBoxHtml = `
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #991b1b; line-height: 1.5;">
          💬 <strong>Questions or Need Help?</strong> Click to chat directly with Aduke Alagbo on WhatsApp at 
          <a href="https://wa.me/2349055126388" style="color: #18422e; font-weight: 800; text-decoration: underline;">+234 905 512 6388</a>.
        </div>
      </div>
    `;
  } else if (isDispatched) {
    emailSubject = `🚚 On Its Way: Your Aduke Alagbo Order (${orderData.orderRef}) Has Been Dispatched!`;
    bannerHtml = `
      <div style="background: #eff6ff; border-bottom: 2px solid #93c5fd; padding: 22px 24px; text-align: center;">
        <div style="display: inline-block; background: #2563eb; color: #ffffff; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; font-size: 20px; font-weight: bold; margin-bottom: 8px;">🚚</div>
        <h2 style="margin: 0; font-size: 19px; color: #1e40af; font-weight: 800; letter-spacing: 0.02em;">ORDER DISPATCHED &amp; IN TRANSIT</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #1d4ed8;">Your herbal remedies are on their way to you!</p>
      </div>
    `;
    messageHtml = `
      <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hello <strong>${customerName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Great news! Your package for order <strong>${escapeHtml(orderData.orderRef)}</strong> has been carefully prepared and is now dispatched with our courier rider.
        ${note ? `<br><br><strong>Courier Note:</strong> ${escapeHtml(note)}` : ''}
      </p>
    `;
    badgeHtml = `<span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; text-transform: uppercase;">In Transit 🚚</span>`;
    totalsBottomHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #1e40af;">
        <span>Order Status:</span>
        <span style="color: #2563eb;">Dispatched &amp; In Transit 🚚</span>
      </div>
    `;
    noticeBoxHtml = `
      <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #1e40af; line-height: 1.5;">
          🚚 <strong>Rider Arrival Alert:</strong> The delivery rider will call or message your phone/WhatsApp (<strong>${escapeHtml(orderData.customer ? orderData.customer.phone : '')}</strong>) before arriving at your address. Please keep your phone line accessible!
        </div>
      </div>
    `;
  } else if (isDelivered) {
    emailSubject = `🌿 Package Delivered: Your Aduke Alagbo Remedies (${orderData.orderRef}) Have Arrived!`;
    bannerHtml = `
      <div style="background: #ecfdf5; border-bottom: 2px solid #6ee7b7; padding: 22px 24px; text-align: center;">
        <div style="display: inline-block; background: #059669; color: #ffffff; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; font-size: 20px; font-weight: bold; margin-bottom: 8px;">🌿</div>
        <h2 style="margin: 0; font-size: 19px; color: #065f46; font-weight: 800; letter-spacing: 0.02em;">PACKAGE DELIVERED SUCCESSFULLY</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #047857;">Your remedies have safely arrived at your destination!</p>
      </div>
    `;
    messageHtml = `
      <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hello <strong>${customerName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Your Aduke Alagbo remedies for order <strong>${escapeHtml(orderData.orderRef)}</strong> have been marked as <strong>DELIVERED</strong>! Thank you for trusting authentic ancestral African remedies for your health.
        ${note ? `<br><br><strong>Delivery Note:</strong> ${escapeHtml(note)}` : ''}
      </p>
    `;
    badgeHtml = `<span style="background: #d1fae5; color: #065f46; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; text-transform: uppercase;">Delivered 🌿</span>`;
    totalsBottomHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #065f46;">
        <span>Delivery Status:</span>
        <span style="color: #059669;">Completed &amp; Delivered 🌿</span>
      </div>
    `;
    noticeBoxHtml = `
      <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #166534; line-height: 1.5;">
          🌿 <strong>Dosage &amp; Care Guidance:</strong> Shake all herbal liquid preparations gently before drinking. Store in a cool, shaded environment (or refrigerate where indicated). If you need any advice on your dosage schedule, message Aduke Alagbo directly on WhatsApp at 
          <a href="https://wa.me/2349055126388" style="color: #166534; font-weight: 800; text-decoration: underline;">+234 905 512 6388</a>.
        </div>
      </div>
    `;
  } else {
    // Verified (Payment Confirmed)
    emailSubject = `✓ Payment Confirmed: Your Aduke Alagbo Order (${orderData.orderRef}) is Being Prepared!`;
    bannerHtml = `
      <div style="background: #ecfdf5; border-bottom: 2px solid #86efac; padding: 22px 24px; text-align: center;">
        <div style="display: inline-block; background: #10b981; color: #ffffff; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; font-size: 20px; font-weight: bold; margin-bottom: 8px;">✓</div>
        <h2 style="margin: 0; font-size: 19px; color: #065f46; font-weight: 800; letter-spacing: 0.02em;">PAYMENT CONFIRMED &amp; VERIFIED</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #047857;">Your bank transfer payment has been confirmed by Aduke Alagbo!</p>
      </div>
    `;
    messageHtml = `
      <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hello <strong>${customerName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Good news! Aduke Alagbo has personally verified your bank transfer payment of <strong>₦${finalTotal.toLocaleString('en-NG')}</strong>.
        Your fresh ancestral herbal remedies are now being prepared, packaged with care, and scheduled for dispatch.
        ${note ? `<br><br><strong>Note:</strong> ${escapeHtml(note)}` : ''}
      </p>
    `;
    badgeHtml = `<span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; text-transform: uppercase;">Payment Confirmed ✓</span>`;
    totalsBottomHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #18422e;">
        <span>Total Confirmed Paid:</span>
        <span style="color: #15803d;">₦${finalTotal.toLocaleString('en-NG')} ✓</span>
      </div>
    `;
    noticeBoxHtml = `
      <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #92400e; line-height: 1.5;">
          🌿 <strong>Fresh Preparation Notice:</strong> Your authentic remedies are being freshly compounded and packaged with care. You will receive another notification once your package is dispatched with our courier rider!
        </div>
      </div>
    `;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #102e20 0%, #18422e 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        ${hasLogo ? `<img src="cid:adukeAlagboLogo" alt="Aduke Alagbo Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #d4af37; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: block; margin: 0 auto 12px;">` : ''}
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.02em; color: #ffffff;">Aduke Alagbo</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Authentic Ancestral African Remedies</p>
      </div>

      ${bannerHtml}

      <div style="padding: 26px;">
        ${messageHtml}

        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Order Reference</span>
            ${badgeHtml}
          </div>
          <div style="font-size: 22px; font-weight: 800; color: #18422e; font-family: monospace;">${orderData.orderRef}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>

        <h3 style="font-size: 14px; color: #18422e; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.04em;">
          📦 Items in Your Package
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px 14px; font-size: 12px; color: #475569; text-transform: uppercase;">Remedy</th>
              <th style="padding: 10px 14px; font-size: 12px; color: #475569; text-transform: uppercase; text-align: center;">Qty</th>
              <th style="padding: 10px 14px; font-size: 12px; color: #475569; text-transform: uppercase; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="background: #fafaf9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px;">
            <span>Subtotal:</span>
            <span>₦${Number(orderData.subtotal || finalTotal).toLocaleString('en-NG')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px;">
            <span>Delivery Courier:</span>
            <span>${deliveryNote}</span>
          </div>
          ${orderData.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; margin-bottom: 6px;">
            <span>Discount Applied:</span>
            <span>-₦${Number(orderData.discount).toLocaleString('en-NG')}</span>
          </div>` : ''}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 10px 0;">
          ${totalsBottomHtml}
        </div>

        <div style="background: #f8fafc; border-left: 4px solid #18422e; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Delivery Destination</div>
          <div style="font-size: 14px; color: #1e293b; font-weight: 600;">${orderData.customer ? escapeHtml(orderData.customer.address) : ''}</div>
          <div style="font-size: 13px; color: #475569; margin-top: 2px;">Phone: <strong>${orderData.customer ? escapeHtml(orderData.customer.phone) : ''}</strong></div>
        </div>

        <!-- Status Notice Box -->
        ${noticeBoxHtml}

        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
          If you have any questions about your dosage or package tracking, message Aduke Alagbo directly on WhatsApp at 
          <a href="https://wa.me/2349055126388" style="color: #18422e; font-weight: 700; text-decoration: underline;">+234 905 512 6388</a>.
        </p>

        <p style="font-size: 14px; color: #18422e; font-weight: 700; margin-bottom: 4px;">
          Aduke Alagbo
        </p>
        <p style="font-size: 12px; color: #64748b; margin-top: 0;">Authentic Ancestral Remedies</p>
      </div>

      <div style="background: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          Aduke Alagbo • 100% Wildcrafted Ancestral Botanicals • Abeokuta, Ogun State, Nigeria
        </p>
      </div>
    </div>
  `;

  const emailAttachments = hasLogo ? [
    {
      filename: 'aduke-alagbo-logo.jpeg',
      path: LOGO_PATH,
      cid: 'adukeAlagboLogo'
    }
  ] : [];

  const mailOptions = {
    from: `"Aduke Alagbo" <${SMTP_USER}>`,
    to: customerEmail,
    subject: emailSubject,
    html: htmlContent,
    attachments: emailAttachments
  };

  const dispatchResult = await sendMailWithFallback(mailOptions);
  if (dispatchResult.sent) {
    console.log(`[CUSTOMER STATUS EMAIL] Delivered (${status}) to ${customerEmail} via ${dispatchResult.method}`);
    return { sent: true, method: dispatchResult.method, status };
  }

  // Fallback notice
  console.log(`[CUSTOMER STATUS EMAIL - FALLBACK] Email dispatch attempted for ${customerEmail} (Order: ${orderData.orderRef}, Status: ${status}). Result: ${dispatchResult.error}`);
  return { 
    sent: false, 
    simulated: true, 
    message: `Status email (${status}) dispatched for ${customerEmail}. Result: ${dispatchResult.error}`,
    status
  };
}

// Endpoint to dispatch customer payment confirmation / status email (Admin Only)
app.post('/api/orders/confirm-payment-email', requireAdminAuth, async (req, res) => {
  const { orderData, status, note } = req.body;
  if (!orderData || !orderData.orderRef) {
    return res.status(400).json({ success: false, message: 'orderData is required' });
  }

  const effectiveStatus = status || orderData.status || 'verified';
  const cleanRef = (orderData.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const orders = await db.getOrders();
  const target = orders.find(o => (o.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase() === cleanRef);

  const result = await sendCustomerPaymentConfirmationEmail(orderData, effectiveStatus, note);
  if (result && result.sent && target) {
    if (effectiveStatus === 'verified') target.paymentConfirmedEmailSent = true;
    if (effectiveStatus === 'dispatched') target.dispatchedEmailSent = true;
    if (effectiveStatus === 'delivered') target.deliveredEmailSent = true;
    if (effectiveStatus === 'cancelled') target.cancelledEmailSent = true;
    await db.saveOrder(target);
  }
  res.json({ success: true, ...result });
});

// Update order status (PATCH - Admin Only)
app.patch('/api/orders/:orderRef/status', requireAdminAuth, async (req, res) => {
  const { orderRef } = req.params;
  const { status, note } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const order = await db.updateOrderStatus(orderRef, status, note);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Automatically send customer confirmation/status email when status is verified, dispatched, delivered, or cancelled
  if (['verified', 'dispatched', 'delivered', 'cancelled'].includes(status)) {
    sendCustomerPaymentConfirmationEmail(order, status, note)
      .then(result => {
        if (result && result.sent) {
          if (status === 'verified') order.paymentConfirmedEmailSent = true;
          if (status === 'dispatched') order.dispatchedEmailSent = true;
          if (status === 'delivered') order.deliveredEmailSent = true;
          if (status === 'cancelled') order.cancelledEmailSent = true;
          db.saveOrder(order).catch(e => console.warn('[SAVE ORDER]', e.message));
        }
      })
      .catch(e => console.warn('[STATUS EMAIL]', e.message));
  }

  console.log(`[ORDER STATUS] ${order.orderRef} updated to ${status}`);
  res.json({ success: true, order, message: `Order ${order.orderRef} status updated to ${status}` });
});

// Also support POST for status update (Admin Only)
app.post('/api/orders/:orderRef/status', requireAdminAuth, async (req, res) => {
  const { orderRef } = req.params;
  const { status, note } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const order = await db.updateOrderStatus(orderRef, status, note);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (['verified', 'dispatched', 'delivered', 'cancelled'].includes(status)) {
    sendCustomerPaymentConfirmationEmail(order, status, note)
      .then(result => {
        if (result && result.sent) {
          if (status === 'verified') order.paymentConfirmedEmailSent = true;
          if (status === 'dispatched') order.dispatchedEmailSent = true;
          if (status === 'delivered') order.deliveredEmailSent = true;
          if (status === 'cancelled') order.cancelledEmailSent = true;
          db.saveOrder(order).catch(e => console.warn('[SAVE ORDER]', e.message));
        }
      })
      .catch(e => console.warn('[STATUS EMAIL]', e.message));
  }

  console.log(`[ORDER STATUS] ${order.orderRef} updated to ${status}`);
  res.json({ success: true, order, message: `Order ${order.orderRef} status updated to ${status}` });
});

/**
 * DELETE /api/orders/:orderRef
 * Remove an order permanently (Admin Only)
 */
app.delete('/api/orders/:orderRef', requireAdminAuth, async (req, res) => {
  const { orderRef } = req.params;
  recordDeletedOrder(orderRef);
  await db.deleteOrder(orderRef);
  const remainingOrders = await db.getOrders();
  console.log(`[ORDER DELETED] ${orderRef} removed (${remainingOrders.length} remaining)`);
  res.json({ success: true, message: `Order ${orderRef} removed`, remaining: remainingOrders.length, deletedOrderRefs: getDeletedOrders() });
});

/**
 * GET /api/inventory
 * Retrieve current product stock levels
 */
app.get('/api/inventory', async (req, res) => {
  const inventory = await db.getInventory();
  res.json({ success: true, inventory });
});

/**
 * POST /api/inventory
 * Update stock level and threshold for a product (Admin Only)
 */
app.post('/api/inventory', requireAdminAuth, async (req, res) => {
  const { productId, stock, lowStockThreshold } = req.body;
  if (!productId) {
    return res.status(400).json({ success: false, message: 'productId is required' });
  }

  const inv = await db.getInventory();
  inv[productId] = {
    stock: Math.max(0, parseInt(stock, 10) || 0),
    lowStockThreshold: Math.max(1, parseInt(lowStockThreshold, 10) || 8),
    lastRestocked: new Date().toISOString()
  };

  await db.saveInventory(inv);
  res.json({ success: true, item: inv[productId], message: `Stock for ${productId} updated to ${inv[productId].stock}` });
});

/**
 * GET /api/db-status
 * Live status of database connection
 */
app.get('/api/db-status', (req, res) => {
  res.json({
    success: true,
    sqlActive: db.isSqlActive(),
    databaseType: db.isSqlActive() ? 'PostgreSQL (Cloud SQL Database)' : 'Local File Storage (Fallback Mode)',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
  });
});

/**
 * GET /api/orders/stats
 * Overview stats of purchases, revenue, and product sales (Admin Only)
 */
app.get('/api/orders/stats', requireAdminAuth, async (req, res) => {
  const orders = await db.getOrders();
  const inv = await db.getInventory();

  let totalRevenue = 0;
  let totalUnitsSold = 0;
  let pendingCount = 0;
  let verifiedCount = 0;
  let dispatchedCount = 0;
  let deliveredCount = 0;

  const productSales = {};

  orders.forEach(ord => {
    if (ord.status === 'cancelled') return;

    totalRevenue += Number(ord.finalTotal || 0);

    if (ord.status === 'pending') pendingCount++;
    else if (ord.status === 'verified') verifiedCount++;
    else if (ord.status === 'dispatched') dispatchedCount++;
    else if (ord.status === 'delivered') deliveredCount++;

    if (Array.isArray(ord.items)) {
      ord.items.forEach(it => {
        const qty = Number(it.quantity) || 1;
        totalUnitsSold += qty;
        if (!productSales[it.id]) {
          productSales[it.id] = {
            id: it.id,
            name: it.name,
            unitsSold: 0,
            revenue: 0,
            ordersCount: 0
          };
        }
        productSales[it.id].unitsSold += qty;
        productSales[it.id].revenue += (Number(it.price) || 0) * qty;
        productSales[it.id].ordersCount += 1;
      });
    }
  });

  res.json({
    success: true,
    stats: {
      totalOrders: orders.length,
      totalRevenue,
      totalUnitsSold,
      pendingCount,
      verifiedCount,
      dispatchedCount,
      deliveredCount,
      productSales
    }
  });
});

// --- STATIC WEBSITE HOSTING WITH BROWSER CACHING ---
app.use(express.static(__dirname, {
  dotfiles: 'ignore', // Never serve hidden files (.env, .git)
  maxAge: '7d', // 7 days browser cache for images, CSS, and JS
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// Route shortcuts
app.get('/shop', (req, res) => {
  res.sendFile(path.join(__dirname, 'shop.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
const os = require('os');
function getLocalNetworkIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

app.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLocalNetworkIp();
  console.log(`\n======================================================`);
  console.log(`🚀 Aduke Alagbo Web Server Running`);
  console.log(`💻 Laptop URL:     http://localhost:${PORT}`);
  console.log(`📱 Phone (Wi-Fi):  http://${lanIp}:${PORT}`);
  console.log(`🛍️  Shop Page:     http://${lanIp}:${PORT}/shop.html`);
  console.log(`🔒 Admin Portal:  http://${lanIp}:${PORT}/admin.html`);
  console.log(`======================================================\n`);
});
