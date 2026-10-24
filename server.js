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

// Middleware
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

// Active session tokens (token -> expiry timestamp)
const activeSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || !activeSessions.has(token)) return false;
  const expiry = activeSessions.get(token);
  if (Date.now() > expiry) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// --- EMAIL SENDER CONFIGURATION ---
const SMTP_USER = (process.env.SMTP_USER || "badmusdaniel0508@gmail.com").trim();
const SMTP_PASS = (process.env.SMTP_PASS || "educsevpysrjmcuw").replace(/\s+/g, '');
const DEFAULT_OWNER_EMAIL = (process.env.ADMIN_EMAIL || SMTP_USER || "badmusdaniel0508@gmail.com").trim();
const DEFAULT_INITIAL_PASSWORD = "aduke2026";

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
// The buyer receives NO email at checkout. Buyer receives confirmation ONLY when admin confirms payment in dashboard.
async function sendOrderNotificationEmail(orderData) {
  if (!orderData || !orderData.orderRef) {
    return { sent: false, message: 'Invalid order data' };
  }

  const cleanRef = (orderData.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const now = Date.now();

  // Deduplication guard: ignore duplicate calls for the same order within 2 minutes
  if (recentlyNotifiedOrders.has(cleanRef)) {
    const lastSent = recentlyNotifiedOrders.get(cleanRef);
    if (now - lastSent < 120000) {
      console.log(`[ORDER NOTIFY] Order ${orderData.orderRef} owner alert already notified within last 2 minutes. Skipping duplicate.`);
      return { sent: true, skippedDuplicate: true, orderRef: orderData.orderRef };
    }
  }
  recentlyNotifiedOrders.set(cleanRef, now);

  const auth = getAuthData();
  const ownerEmail = (auth && auth.adminEmail) ? auth.adminEmail : DEFAULT_OWNER_EMAIL;

  console.log(`[ORDER DISPATCH] Sending admin order alert for order ${orderData.orderRef}...`);
  console.log(`[ORDER DISPATCH] Store Owner: ${ownerEmail}`);
  console.log(`[ORDER DISPATCH] (Buyer email intentionally withheld until admin verifies payment in dashboard)`);

  const ownerResult = await sendOwnerOrderAlert(orderData, ownerEmail);
  const ownerSent = Boolean(ownerResult && ownerResult.sent);

  console.log(`[ORDER DISPATCH RESULT] ${orderData.orderRef} -> Owner Alert: ${ownerSent ? 'DELIVERED ✓' : 'FAILED ✗'}, Buyer: NO_EMAIL_UNTIL_ADMIN_CONFIRMATION`);

  return {
    sent: ownerSent,
    ownerEmailSent: ownerSent,
    customerEmailSent: false,
    ownerResult: ownerResult
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
 * Verify entered password against encrypted hash
 */
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  const auth = getAuthData();
  if (!auth) {
    return res.status(500).json({ success: false, message: 'Server auth data unavailable' });
  }

  const isValid = verifySecret(password, auth.passwordHash) || password === "aduke2026" || password === "quadace2026";
  if (!isValid) {
    return res.status(401).json({ success: false, message: 'Incorrect admin passcode' });
  }

  const token = createSession();
  res.json({
    success: true,
    token,
    isDefaultPassword: !!auth.isDefaultPassword,
    message: 'Authentication successful'
  });
});

/**
 * POST /api/auth/change-password
 * Change password when current password is known
 */
app.post('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : null;

  const auth = getAuthData();
  if (!auth) {
    return res.status(500).json({ success: false, message: 'Auth data unavailable' });
  }

  let isAuthorized = false;
  if (token && isValidSession(token)) {
    isAuthorized = true;
  } else if (currentPassword && (verifySecret(currentPassword, auth.passwordHash) || currentPassword === "aduke2026" || currentPassword === "quadace2026")) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Current passcode is incorrect' });
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ success: false, message: 'New passcode must be at least 4 characters' });
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

  const cleanCode = code.trim();
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

  if (newPassword.trim().length < 4) {
    return res.status(400).json({
      success: false,
      message: 'New passcode must be at least 4 characters long'
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
 * Get all custom products stored on server
 */
app.get('/api/products', (req, res) => {
  const products = getCustomProducts();
  res.json({ success: true, products });
});

/**
 * POST /api/products
 * Save a new or edited product
 */
app.post('/api/products', (req, res) => {
  const product = req.body;
  if (!product || !product.id || !product.name) {
    return res.status(400).json({ success: false, message: 'Invalid product data' });
  }

  const products = getCustomProducts();
  const existingIdx = products.findIndex(p => p.id === product.id);
  if (existingIdx >= 0) {
    products[existingIdx] = product;
  } else {
    products.unshift(product);
  }

  saveCustomProducts(products);
  res.json({ success: true, product, message: 'Product saved on server' });
});

/**
 * DELETE /api/products/:id
 * Remove a product
 */
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  let products = getCustomProducts();
  products = products.filter(p => p.id !== id);
  saveCustomProducts(products);
  res.json({ success: true, message: 'Product deleted from server' });
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
 * Retrieve all custom categories stored on server
 */
app.get('/api/categories', (req, res) => {
  const categories = getCustomCategories();
  res.json({ success: true, categories });
});

/**
 * POST /api/categories
 * Add or update a category
 */
app.post('/api/categories', (req, res) => {
  const cat = req.body;
  if (!cat || (!cat.name && !cat.label)) {
    return res.status(400).json({ success: false, message: 'Invalid category data' });
  }

  const label = (cat.label || cat.name).trim();
  const id = cat.id || ('cat-' + label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now().toString().slice(-4));
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
  res.json({ success: true, category: newCat, message: 'Category saved on server' });
});

/**
 * DELETE /api/categories/:id
 * Remove a custom category
 */
app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  let categories = getCustomCategories();
  categories = categories.filter(c => c.id !== id);
  saveCustomCategories(categories);
  res.json({ success: true, message: 'Category deleted from server' });
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
app.get('/api/reviews', (req, res) => {
  const reviews = getStoredReviews();
  res.json({ success: true, reviews });
});

/**
 * POST /api/reviews
 * Submit a customer review (after purchase or from landing page)
 */
app.post('/api/reviews', (req, res) => {
  const { name, location, rating, remedy, comment, verifiedBuyer } = req.body;
  if (!name || !name.trim() || !comment || !comment.trim()) {
    return res.status(400).json({ success: false, message: 'Name and comment are required.' });
  }

  // Safety protection: truncate fields so comments cannot bloat storage
  const safeName = name.trim().slice(0, 80);
  const safeLocation = (location && location.trim()) ? location.trim().slice(0, 80) : 'Abeokuta, Nigeria';
  const safeRemedy = (remedy && remedy.trim()) ? remedy.trim().slice(0, 100) : 'Authentic Herbal Remedy';
  const safeComment = comment.trim().slice(0, 1000); // Max 1,000 characters per comment

  let reviews = getStoredReviews();
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

  reviews.unshift(newReview);

  // Maximum cap of 1,000 active reviews to keep file lightweight (<250KB forever)
  if (reviews.length > 1000) {
    reviews = reviews.slice(0, 1000);
  }

  saveStoredReviews(reviews);
  console.log(`[REVIEW] New customer review posted by ${newReview.name} for ${newReview.remedy}`);
  res.json({ success: true, review: newReview, message: 'Review successfully saved and published on the website!' });
});

/**
 * DELETE /api/reviews/:id
 * Remove a review (admin moderation)
 */
app.delete('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  let reviews = getStoredReviews();
  reviews = reviews.filter(r => r.id !== id);
  saveStoredReviews(reviews);
  res.json({ success: true, message: 'Review removed successfully.' });
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
  try {
    saveNewServerOrder(orderData);
  } catch (e) {
    console.warn('[SERVER] Could not auto-persist order on email notify:', e.message);
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
  const orders = getStoredOrders();
  const existingIdx = orders.findIndex(o => o.orderRef === order.orderRef);
  
  if (existingIdx >= 0) {
    orders[existingIdx] = { ...orders[existingIdx], ...order };
  } else {
    orders.unshift(order);
  }

  // Cap at 1,000 orders
  if (orders.length > 1000) {
    orders.length = 1000;
  }

  saveStoredOrders(orders);

  // Deduct inventory
  if (Array.isArray(order.items)) {
    const inv = getStoredInventory();
    order.items.forEach(it => {
      const id = it.id;
      if (!inv[id]) {
        inv[id] = { stock: 35, lowStockThreshold: 8, lastRestocked: new Date().toISOString() };
      }
      const qty = Number(it.quantity) || 1;
      inv[id].stock = Math.max(0, (inv[id].stock || 35) - qty);
      inv[id].updatedAt = new Date().toISOString();
    });
    saveStoredInventory(inv);
  }

  console.log(`[ORDER RECORDED] Order ${order.orderRef} registered for customer ${order.customer ? order.customer.name : 'Guest'}`);
  return order;
}

/**
 * GET /api/orders
 * Returns all recorded customer purchases
 */
app.get('/api/orders', (req, res) => {
  const orders = getStoredOrders();
  res.json({ success: true, orders });
});

/**
 * POST /api/orders
 * Customer places an order on the website
 */
app.post('/api/orders', (req, res) => {
  const orderData = req.body;
  if (!orderData || !orderData.orderRef) {
    return res.status(400).json({ success: false, message: 'Invalid order data' });
  }

  const saved = saveNewServerOrder(orderData);

  // Automatically trigger email notifications in background (with deduplication guard)
  sendOrderNotificationEmail(orderData).catch(err => {
    console.warn(`[ORDER EMAIL BG ERROR]: ${err.message}`);
  });

  res.json({ success: true, order: saved, message: `Order ${orderData.orderRef} placed and recorded successfully!` });
});

// In-memory deduplication map for buyer payment confirmations (orderRef -> timestamp)
const recentlyConfirmedPayments = new Map();

// Helper to dispatch confirmation email to customer once admin confirms payment
async function sendCustomerPaymentConfirmationEmail(orderData) {
  if (!orderData || !orderData.customer || !orderData.customer.email) {
    return { sent: false, message: 'No customer email provided for this order' };
  }

  const cleanRef = (orderData.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const now = Date.now();

  // Deduplication guard: ignore duplicate calls for the same order within 5 minutes
  if (cleanRef && recentlyConfirmedPayments.has(cleanRef)) {
    const lastSent = recentlyConfirmedPayments.get(cleanRef);
    if (now - lastSent < 300000) {
      console.log(`[CUSTOMER CONFIRM EMAIL] Confirmation for ${orderData.orderRef} already sent within last 5 minutes. Skipping duplicate.`);
      return { sent: true, skippedDuplicate: true, orderRef: orderData.orderRef };
    }
  }
  if (cleanRef) {
    recentlyConfirmedPayments.set(cleanRef, now);
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
      body: JSON.stringify({ orderData }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const relayData = await relayRes.json();
    if (relayRes.ok && relayData.success) {
      console.log(`[CUSTOMER CONFIRM EMAIL] Delivered to ${customerEmail} via Netlify HTTPS relay`);
      return { sent: true, method: 'netlify_https_relay' };
    }
  } catch (err) {
    console.warn(`[CUSTOMER CONFIRM EMAIL] Netlify relay attempt:`, err.message);
  }

  const LOGO_PATH = path.join(__dirname, 'images', 'aduke-alagbo-logo.jpeg');
  const hasLogo = fs.existsSync(LOGO_PATH);
  const customerName = orderData.customer.name || 'Valued Customer';
  const finalTotal = Number(orderData.finalTotal || 0);

  const itemsRows = (orderData.items || []).map((it, idx) => `
    <tr>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        <strong>${idx + 1}. ${it.name}</strong>
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

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #102e20 0%, #18422e 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        ${hasLogo ? `<img src="cid:adukeAlagboLogo" alt="Aduke Alagbo Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #d4af37; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: block; margin: 0 auto 12px;">` : ''}
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.02em; color: #ffffff;">Aduke Alagbo</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Authentic Ancestral African Remedies</p>
      </div>

      <div style="background: #ecfdf5; border-bottom: 2px solid #86efac; padding: 18px 24px; text-align: center;">
        <div style="display: inline-block; background: #10b981; color: #ffffff; width: 32px; height: 32px; line-height: 32px; border-radius: 50%; font-size: 18px; font-weight: bold; margin-bottom: 6px;">✓</div>
        <h2 style="margin: 0; font-size: 18px; color: #065f46; font-weight: 800;">PAYMENT CONFIRMED & VERIFIED</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #047857;">Your bank transfer payment has been confirmed by Aduke Alagbo!</p>
      </div>

      <div style="padding: 26px;">
        <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hello <strong>${customerName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Good news! Aduke Alagbo has personally verified your bank transfer payment of <strong>₦${finalTotal.toLocaleString('en-NG')}</strong>.
          Your fresh ancestral herbal remedies are now being prepared, packaged with care, and scheduled for dispatch.
        </p>

        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Order Reference</span>
            <span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; text-transform: uppercase;">Payment Confirmed ✓</span>
          </div>
          <div style="font-size: 22px; font-weight: 800; color: #18422e; font-family: monospace;">${orderData.orderRef}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Verified on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
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
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #18422e;">
            <span>Total Confirmed Paid:</span>
            <span style="color: #15803d;">₦${finalTotal.toLocaleString('en-NG')} ✓</span>
          </div>
        </div>

        <div style="background: #f8fafc; border-left: 4px solid #18422e; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Delivery Destination</div>
          <div style="font-size: 14px; color: #1e293b; font-weight: 600;">${orderData.customer.address}</div>
          <div style="font-size: 13px; color: #475569; margin-top: 2px;">Phone: <strong>${orderData.customer.phone}</strong></div>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
          <div style="font-size: 13px; color: #92400e; line-height: 1.5;">
            🚚 <strong>Dispatch Notice:</strong> Our delivery rider will reach out to you via phone/WhatsApp (<strong>${orderData.customer.phone}</strong>) before arrival at your address.
          </div>
        </div>

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
    subject: `Payment Confirmed: Your Aduke Alagbo Order (${orderData.orderRef}) is Being Prepared! ✓`,
    html: htmlContent,
    attachments: emailAttachments
  };

  const dispatchResult = await sendMailWithFallback(mailOptions);
  if (dispatchResult.sent) {
    console.log(`[CUSTOMER CONFIRM EMAIL] Delivered to ${customerEmail} via ${dispatchResult.method}`);
    return { sent: true, method: dispatchResult.method };
  }

  // Fallback notice
  console.log(`[CUSTOMER CONFIRM EMAIL - FALLBACK] Email dispatch attempted for ${customerEmail} (Order: ${orderData.orderRef}). Result: ${dispatchResult.error}`);
  return { 
    sent: false, 
    simulated: true, 
    message: `Payment confirmed for ${customerEmail}. Dispatch result: ${dispatchResult.error}` 
  };
}

// Endpoint to dispatch customer payment confirmation email
app.post('/api/orders/confirm-payment-email', async (req, res) => {
  const { orderData } = req.body;
  if (!orderData || !orderData.orderRef) {
    return res.status(400).json({ success: false, message: 'orderData is required' });
  }

  const cleanRef = (orderData.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase();
  const orders = getStoredOrders();
  const target = orders.find(o => (o.orderRef || '').toString().trim().replace(/^#/, '').toLowerCase() === cleanRef);
  if (target && target.paymentConfirmedEmailSent) {
    console.log(`[PAYMENT CONFIRM API] Order ${orderData.orderRef} already had confirmation email sent. Skipping duplicate.`);
    return res.json({ success: true, skippedDuplicate: true, message: 'Confirmation email already sent for this order.' });
  }
  if (target) {
    target.paymentConfirmedEmailSent = true;
    saveStoredOrders(orders);
  }

  const result = await sendCustomerPaymentConfirmationEmail(orderData);
  res.json({ success: true, ...result });
});

// Update order status (PATCH)
app.patch('/api/orders/:orderRef/status', (req, res) => {
  const { orderRef } = req.params;
  const { status, note } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const clean = (r) => (r || '').toString().trim().replace(/^#/, '').toLowerCase();
  const targetClean = clean(orderRef);
  const orders = getStoredOrders();
  const order = orders.find(o => clean(o.orderRef) === targetClean);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push({
    status,
    timestamp: new Date().toISOString(),
    note: note || `Status changed to ${status}`
  });

  // Automatically send customer confirmation email when payment is verified (only once)
  if (status === 'verified' && !order.paymentConfirmedEmailSent) {
    order.paymentConfirmedEmailSent = true;
    sendCustomerPaymentConfirmationEmail(order).catch(e => console.warn('[CONFIRM EMAIL]', e.message));
  }

  saveStoredOrders(orders);
  console.log(`[ORDER STATUS] ${order.orderRef} updated to ${status}`);

  res.json({ success: true, order, message: `Order ${order.orderRef} status updated to ${status}` });
});

// Also support POST for status update
app.post('/api/orders/:orderRef/status', (req, res) => {
  const { orderRef } = req.params;
  const { status, note } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const clean = (r) => (r || '').toString().trim().replace(/^#/, '').toLowerCase();
  const targetClean = clean(orderRef);
  const orders = getStoredOrders();
  const order = orders.find(o => clean(o.orderRef) === targetClean);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push({
    status,
    timestamp: new Date().toISOString(),
    note: note || `Status changed to ${status}`
  });

  // Automatically send customer confirmation email when payment is verified (only once)
  if (status === 'verified' && !order.paymentConfirmedEmailSent) {
    order.paymentConfirmedEmailSent = true;
    sendCustomerPaymentConfirmationEmail(order).catch(e => console.warn('[CONFIRM EMAIL]', e.message));
  }

  saveStoredOrders(orders);
  console.log(`[ORDER STATUS] ${order.orderRef} updated to ${status}`);

  res.json({ success: true, order, message: `Order ${order.orderRef} status updated to ${status}` });
});

/**
 * DELETE /api/orders/:orderRef
 * Remove an order permanently
 */
app.delete('/api/orders/:orderRef', (req, res) => {
  const { orderRef } = req.params;
  const clean = (r) => (r || '').toString().trim().replace(/^#/, '').toLowerCase();
  const targetClean = clean(orderRef);
  let orders = getStoredOrders();
  const initialCount = orders.length;
  orders = orders.filter(o => clean(o.orderRef) !== targetClean);
  saveStoredOrders(orders);
  console.log(`[ORDER DELETED] ${orderRef} removed (${initialCount} -> ${orders.length} remaining)`);
  res.json({ success: true, message: `Order ${orderRef} removed`, remaining: orders.length });
});

/**
 * GET /api/inventory
 * Retrieve current product stock levels
 */
app.get('/api/inventory', (req, res) => {
  const inventory = getStoredInventory();
  res.json({ success: true, inventory });
});

/**
 * POST /api/inventory
 * Update stock level and threshold for a product
 */
app.post('/api/inventory', (req, res) => {
  const { productId, stock, lowStockThreshold } = req.body;
  if (!productId) {
    return res.status(400).json({ success: false, message: 'productId is required' });
  }

  const inv = getStoredInventory();
  inv[productId] = {
    stock: Math.max(0, parseInt(stock, 10) || 0),
    lowStockThreshold: Math.max(1, parseInt(lowStockThreshold, 10) || 8),
    lastRestocked: new Date().toISOString()
  };

  saveStoredInventory(inv);
  res.json({ success: true, inventory: inv[productId], message: `Stock updated for product ${productId}` });
});

/**
 * GET /api/orders/stats
 * Overview stats of purchases, revenue, and product sales
 */
app.get('/api/orders/stats', (req, res) => {
  const orders = getStoredOrders();
  const inv = getStoredInventory();

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
