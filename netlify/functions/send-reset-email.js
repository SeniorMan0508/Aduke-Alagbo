const nodemailer = require('nodemailer');
const { ADUKE_LOGO_BASE64 } = require('./logo-asset');

const SMTP_USER = (process.env.SMTP_USER || "badmusdaniel0508@gmail.com").trim();
const SMTP_PASS = (process.env.SMTP_PASS || "educsevpysrjmcuw").replace(/\s+/g, '');

function getEmailTransporter() {
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

  const { toEmail, code } = body || {};

  if (!toEmail || !code || code.toString().length < 6) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Missing recipient email or valid 6-digit code" }) };
  }

  const transporter = getEmailTransporter();
  if (!transporter) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: "SMTP credentials not configured on Netlify environment." })
    };
  }

  const logoSrc = 'cid:adukeAlagboLogo';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div style="text-align: center; margin-bottom: 22px;">
        <img src="${logoSrc}" alt="Aduke Alagbo Logo" style="width: 76px; height: 76px; border-radius: 50%; object-fit: cover; border: 2.5px solid #d4af37; box-shadow: 0 4px 10px rgba(0,0,0,0.12); display: block; margin: 0 auto 12px;">
        <h2 style="color: #18422e; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Aduke Alagbo</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; font-weight: 500;">Admin Security & Passcode Reset</p>
      </div>

      <p style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">Hello Store Owner,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-top: 0;">
        We received a request to reset your admin dashboard passcode. Enter the following 6-digit verification code on your screen to complete the reset and set your new passcode:
      </p>

      <div style="background: #fbf7ee; border: 1.5px solid #d4af37; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #18422e; font-family: 'Courier New', Courier, monospace;">
          ${code}
        </div>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
        ⏳ <strong>Note:</strong> This verification code is valid for <strong>15 minutes</strong>. If you did not request this password reset, you can safely ignore this email — your account remains completely secure.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 22px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Aduke Alagbo • Authentic Ancestral Remedies • Abeokuta, Ogun State, Nigeria
      </p>
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
      from: `"Aduke Alagbo Security" <${SMTP_USER}>`,
      to: toEmail,
      subject: "Your Aduke Alagbo Admin Password Reset Code",
      html: htmlContent,
      attachments: emailAttachments
    });

    console.log(`[NETLIFY RESET EMAIL] Verification code sent successfully to ${toEmail}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Verification code sent to email successfully." })
    };
  } catch (err) {
    console.error("[NETLIFY RESET EMAIL ERROR]:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
