const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const DEFAULT_OWNER_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "seller@quadaceherbs.com";

function getEmailTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // port 587 uses STARTTLS
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000
  });
}

exports.handler = async (event, context) => {
  // CORS headers
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

  let orderData;
  try {
    orderData = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!orderData || !orderData.orderRef) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing order reference" }) };
  }

  const transporter = getEmailTransporter();
  const ownerEmail = process.env.ADMIN_EMAIL || DEFAULT_OWNER_EMAIL;

  // Store Logo
  const publicLogoUrl = "https://quad-ace-herbs.onrender.com/images/bg-image.jpeg";
  const localLogoPath = path.join(__dirname, '..', '..', 'images', 'bg-image.jpeg');
  const hasLocalLogo = fs.existsSync(localLogoPath);

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

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <!-- Brand Header with Logo Image -->
      <div style="background: linear-gradient(135deg, #102e20 0%, #18422e 100%); padding: 26px 20px; text-align: center; color: #ffffff;">
        <img src="${hasLocalLogo ? 'cid:storeLogo' : publicLogoUrl}" alt="Quad-Ace Herbs Logo" style="width: 78px; height: 78px; border-radius: 50%; object-fit: cover; border: 3px solid #d4af37; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: block; margin: 0 auto 10px;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.02em; color: #ffffff;">Quad-Ace Herbs</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Official Store Order Notification</p>
      </div>

      <div style="padding: 24px;">
        <div style="background: #f8fafc; border-left: 4px solid #18422e; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
          <div style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: 700;">Order Reference</div>
          <div style="font-size: 20px; font-weight: 800; color: #18422e; font-family: monospace;">${orderData.orderRef}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Placed on ${new Date().toLocaleDateString('en-GB')}</div>
        </div>

        <!-- Customer Details Box -->
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
            <td style="color: #1e293b; font-weight: 700;"><a href="tel:${orderData.customer ? orderData.customer.phone : ''}" style="color: #18422e; text-decoration: none;">${orderData.customer ? orderData.customer.phone : ''}</a></td>
          </tr>
          <tr>
            <td style="color: #64748b; vertical-align: top;"><strong>Email:</strong></td>
            <td style="color: #1e293b;">${(orderData.customer && orderData.customer.email) || 'Not provided'}</td>
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
          <div style="font-size: 12px; color: #15803d; line-height: 1.5;">
            ${orderData.paymentMethod === 'bank'
              ? '<strong>Action Required:</strong> Check your instant Kuda Bank alert to verify credit of ₦' + Number(orderData.finalTotal || 0).toLocaleString('en-NG') + ' before dispatching package.'
              : 'Customer selected direct WhatsApp order confirmation.'}
          </div>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Quad-Ace Herbs • Authentic Ancestral Remedies • Abeokuta, Ogun State, Nigeria
        </p>
      </div>
    </div>
  `;

  const emailAttachments = hasLocalLogo ? [
    {
      filename: 'quad-ace-logo.jpeg',
      path: localLogoPath,
      cid: 'storeLogo'
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

  const subject = `New Order: ${orderData.customer ? orderData.customer.name : 'Customer'} (${orderData.orderRef}) - Quad-Ace Herbs`;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Quad-Ace Herbs Store" <${process.env.SMTP_USER}>`,
        to: ownerEmail,
        subject: subject,
        html: htmlContent,
        attachments: emailAttachments
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: "Order notification sent with brand logo!" })
      };
    } catch (err) {
      console.error("[NETLIFY FUNCTION SMTP ERROR]:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: err.message })
      };
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: false, method: "simulated", message: "SMTP credentials not provided in environment." })
  };
};
