const nodemailer = require('nodemailer');
const { ADUKE_LOGO_BASE64 } = require('./logo-asset');

const SMTP_USER = (process.env.SMTP_USER || "badmusdaniel0508@gmail.com").trim();
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, '');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailTransporter() {
  if (!SMTP_PASS) {
    console.warn('[SMTP] No SMTP_PASS configured in environment variables');
    return null;
  }
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // port 587 uses STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000
  });
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const orderData = (body && body.orderData) ? body.orderData : (body || {});

  if (!orderData || !orderData.orderRef || !orderData.customer || !orderData.customer.email) {
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ success: false, message: "Missing orderData, orderRef, or customer email" }) 
    };
  }

  const transporter = getEmailTransporter();
  if (!transporter) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: "SMTP credentials not configured." })
    };
  }

  const customerEmail = orderData.customer.email.trim();
  const customerName = orderData.customer.name ? escapeHtml(orderData.customer.name) : "Valued Customer";
  const orderRef = escapeHtml(orderData.orderRef);
  const finalTotal = Number(orderData.finalTotal || 0);

  const itemsRows = (orderData.items || []).map((it, idx) => `
    <tr>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        <strong>${idx + 1}. ${escapeHtml(it.name)}</strong>
      </td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: center; color: #475569;">
        x${Number(it.quantity) || 1}
      </td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: 700; color: #18422e;">
        ₦${Number((it.price || 0) * (it.quantity || 1)).toLocaleString('en-NG')}
      </td>
    </tr>
  `).join('');

  const rawStatus = (body && body.status) || 
                    (orderData && orderData.status) || 
                    (body && body.newStatus) ||
                    (body && body.type) || 
                    'verified';
  const status = String(rawStatus).toLowerCase().trim();
  const note = (body && body.note) || (orderData && orderData.note) || '';

  const isCancelled = ['cancelled', 'canceled', 'cancel'].includes(status);
  const isDispatched = ['dispatched', 'dispatch', 'in_transit', 'intransit'].includes(status);
  const isDelivered = ['delivered', 'deliver', 'completed'].includes(status);
  const isOrderReceived = ['order_received', 'received', 'pending', 'order_placed', 'checkout'].includes(status);

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
    emailSubject = `❌ Order Cancelled: Aduke Alagbo Order (${orderRef})`;
    bannerHtml = `
      <div style="background: #fef2f2; border-bottom: 2px solid #f87171; padding: 22px 24px; text-align: center;">
        <div style="display: inline-block; background: #dc2626; color: #ffffff; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; font-size: 20px; font-weight: bold; margin-bottom: 8px;">✕</div>
        <h2 style="margin: 0; font-size: 19px; color: #991b1b; font-weight: 800; letter-spacing: 0.02em;">ORDER CANCELLED</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #b91c1c;">Notice regarding order reference ${orderRef}</p>
      </div>
    `;
    messageHtml = `
      <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hello <strong>${customerName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Please be informed that your order <strong>${orderRef}</strong> has been <strong>cancelled</strong> by store administration and will not be prepared or shipped.
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
    emailSubject = `🚚 On Its Way: Your Aduke Alagbo Order (${orderRef}) Has Been Dispatched!`;
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
        Great news! Your package for order <strong>${orderRef}</strong> has been carefully prepared and is now dispatched with our courier rider.
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
    emailSubject = `🌿 Package Delivered: Your Aduke Alagbo Remedies (${orderRef}) Have Arrived!`;
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
        Your Aduke Alagbo remedies for order <strong>${orderRef}</strong> have been marked as <strong>DELIVERED</strong>! Thank you for trusting authentic ancestral African remedies for your health.
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
  } else if (isOrderReceived) {
    // Order Received (Buyer Checkout Receipt)
    emailSubject = `🧾 Order & Payment Proof Received: Aduke Alagbo Order (${orderRef})`;
    bannerHtml = `
      <div style="background: #fefce8; border-bottom: 2px solid #fef08a; padding: 22px 24px; text-align: center;">
        <div style="display: inline-block; background: #eab308; color: #ffffff; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; font-size: 20px; font-weight: bold; margin-bottom: 8px;">🧾</div>
        <h2 style="margin: 0; font-size: 19px; color: #854d0e; font-weight: 800; letter-spacing: 0.02em;">ORDER &amp; PAYMENT PROOF RECEIVED</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #a16207;">Thank you! Your order has been placed and payment proof received.</p>
      </div>
    `;
    messageHtml = `
      <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hello <strong>${customerName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Thank you for shopping with <strong>Aduke Alagbo</strong>! We have successfully received your order <strong>${orderRef}</strong> and payment proof for <strong>₦${finalTotal.toLocaleString('en-NG')}</strong>.
        Our team is verifying your bank transfer alert. Once verified, you will receive an official payment confirmation and dispatch tracking update!
      </p>
    `;
    badgeHtml = `<span style="background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; text-transform: uppercase;">Awaiting Verification ⏳</span>`;
    totalsBottomHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #854d0e;">
        <span>Payment Status:</span>
        <span style="color: #a16207;">Proof Received (Awaiting Verification) ⏳</span>
      </div>
    `;
    noticeBoxHtml = `
      <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #92400e; line-height: 1.5;">
          🌿 <strong>What Happens Next:</strong> We will cross-check your bank transfer alert and begin freshly preparing your natural herbal remedies. If you have any urgent inquiry or need to share receipt screenshot, message Aduke Alagbo directly on WhatsApp at 
          <a href="https://wa.me/2349055126388" style="color: #854d0e; font-weight: 800; text-decoration: underline;">+234 905 512 6388</a>.
        </div>
      </div>
    `;
  } else {
    // Verified (Payment Confirmed)
    emailSubject = `✓ Payment Confirmed: Your Aduke Alagbo Order (${orderRef}) is Being Prepared!`;
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
      
      <!-- Header with Aduke Alagbo Logo -->
      <div style="background: linear-gradient(135deg, #102e20 0%, #18422e 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        <img src="cid:adukeAlagboLogo" alt="Aduke Alagbo Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #d4af37; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: block; margin: 0 auto 12px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.02em; color: #ffffff;">Aduke Alagbo</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Authentic Ancestral African Remedies</p>
      </div>

      ${bannerHtml}

      <div style="padding: 26px;">
        ${messageHtml}

        <!-- Order Reference Badge -->
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Order Reference</span>
            ${badgeHtml}
          </div>
          <div style="font-size: 22px; font-weight: 800; color: #18422e; font-family: monospace;">${orderRef}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>

        <!-- Items Ordered Table -->
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

        <!-- Totals Breakdown -->
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

        <!-- Delivery Address Details -->
        <div style="background: #f8fafc; border-left: 4px solid #18422e; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Delivery Destination</div>
          <div style="font-size: 14px; color: #1e293b; font-weight: 600;">${escapeHtml(orderData.customer ? orderData.customer.address : '')}</div>
          <div style="font-size: 13px; color: #475569; margin-top: 2px;">Phone: <strong>${escapeHtml(orderData.customer ? orderData.customer.phone : '')}</strong></div>
          ${orderData.customer && orderData.customer.notes ? `<div style="font-size: 12px; color: #64748b; margin-top: 4px;"><em>Note: ${escapeHtml(orderData.customer.notes)}</em></div>` : ''}
        </div>

        <!-- Status Notice Box -->
        ${noticeBoxHtml}

        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
          If you have any questions about your remedies or tracking, you can message Aduke Alagbo directly on WhatsApp at 
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

  const emailAttachments = [
    {
      filename: 'aduke-alagbo-logo.jpeg',
      content: Buffer.from(ADUKE_LOGO_BASE64, 'base64'),
      cid: 'adukeAlagboLogo'
    }
  ];

  try {
    await transporter.sendMail({
      from: `"Aduke Alagbo" <${SMTP_USER}>`,
      to: customerEmail,
      subject: emailSubject,
      html: htmlContent,
      attachments: emailAttachments
    });

    console.log(`[CUSTOMER STATUS EMAIL] Order ${orderRef} (${status}) email delivered to ${customerEmail}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        status: status,
        message: `Order status email (${status}) sent directly to customer (${customerEmail})` 
      })
    };
  } catch (err) {
    console.error("[CUSTOMER CONFIRM EMAIL ERROR]:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
