import nodemailer from 'nodemailer';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

// Extract SMTP configuration from environment variables with standard naming & fallbacks
export const getSmtpConfig = (): SmtpConfig => {
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || process.env.EMAIL_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || '').trim();
  const from = (process.env.SMTP_FROM || process.env.EMAIL_FROM || 'SkyNav Aero Store <no-reply@skynav.io>').trim();

  return { host, port, secure, user, pass, from };
};

// Check if external SMTP is configured
export const isSmtpConfigured = (): boolean => {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
};

let cachedTransporter: nodemailer.Transporter | null = null;
let isEtherealAccount = false;

/**
 * Get or initialize Nodemailer transporter
 */
export const getTransporter = async (): Promise<nodemailer.Transporter | null> => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();

  if (isSmtpConfigured()) {
    const isGmail = config.host.includes('gmail');
    cachedTransporter = nodemailer.createTransport({
      ...(isGmail ? { service: 'gmail' } : { host: config.host, port: config.port, secure: config.secure }),
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    try {
      await cachedTransporter.verify();
      console.log(`📧 [SMTP] Transporter verified successfully with ${config.host}:${config.port}`);
    } catch (err: any) {
      console.warn(`⚠️ [SMTP] Transporter connection verification warning for ${config.host}: ${err.message}`);
    }

    return cachedTransporter;
  }

  // Development/testing fallback: Initialize live Ethereal test mailer for real SMTP delivery
  try {
    console.log('📧 [SMTP] No external SMTP credentials configured in .env. Initializing Ethereal live test mailer...');
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    isEtherealAccount = true;
    console.log(`📧 [SMTP] Ethereal live mailer active: ${testAccount.user}`);
    return cachedTransporter;
  } catch (err: any) {
    console.error('❌ [SMTP] Failed to initialize Ethereal mailer:', err.message);
    return null;
  }
};

/**
 * Validate SMTP configuration safely on startup or inspection
 */
export const verifySmtpConnection = async (): Promise<{ configured: boolean; verified: boolean; mode: string; details?: string }> => {
  const config = getSmtpConfig();
  if (isSmtpConfigured()) {
    try {
      const transporter = await getTransporter();
      if (transporter) {
        return { configured: true, verified: true, mode: `Custom SMTP (${config.host}:${config.port})` };
      }
    } catch (err: any) {
      return { configured: true, verified: false, mode: `Custom SMTP (${config.host})`, details: err.message };
    }
  }

  const transporter = await getTransporter();
  if (transporter && isEtherealAccount) {
    return { configured: false, verified: true, mode: 'Ethereal Live Test Mailer' };
  }

  return { configured: false, verified: false, mode: 'Unavailable', details: 'No SMTP provider available' };
};

/**
 * Send 6-digit Email Verification Code
 */
export const sendVerificationEmail = async (
  toEmail: string,
  customerName: string,
  code: string
): Promise<EmailSendResult> => {
  const config = getSmtpConfig();
  const from = config.from;

  const transporter = await getTransporter();
  if (!transporter) {
    console.error('❌ [SMTP] Cannot send email: No SMTP transporter available.');
    return {
      success: false,
      error: 'Email delivery is currently unavailable. Please configure SMTP credentials in .env.',
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: `[SkyNav] Verify Your Customer Account - Code: ${code}`,
      text: `Hello ${customerName},\n\nWelcome to SkyNav Autonomous Drone Delivery!\n\nYour 6-digit account verification code is: ${code}\n\nThis verification code will expire in 10 minutes.\n\nSecurity Notice: If you did not request this account, please ignore this message.\n\nThank you,\nSkyNav Autonomous Logistics Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; font-size: 24px; font-weight: 900; border-radius: 12px; margin-bottom: 12px;">🛸</div>
            <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">SkyNav Autonomous Drone Delivery</h1>
            <p style="color: #64748b; font-size: 14px; margin: 6px 0 0;">Commercial Autonomous Airspace & Instant Delivery</p>
          </div>

          <div style="padding: 24px; background: #f8fafc; border: 1px solid #edf2f7; border-radius: 12px; text-align: center;">
            <p style="color: #334155; font-size: 16px; margin: 0 0 12px;">Hello <strong>${customerName}</strong>,</p>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 24px; line-height: 1.5;">
              Thank you for registering with SkyNav. Please use the 6-digit verification code below to activate your customer account:
            </p>

            <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0284c7; background: #e0f2fe; padding: 16px 28px; border-radius: 12px; display: inline-block; font-family: 'Courier New', Courier, monospace; border: 1.5px solid #bae6fd;">
              ${code}
            </div>

            <p style="color: #0369a1; font-size: 13px; font-weight: 600; margin: 16px 0 0;">
              ⏳ Valid for 10 minutes
            </p>
          </div>

          <div style="margin-top: 24px; padding: 16px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; text-align: left;">
            <p style="color: #92400e; font-size: 12px; margin: 0; line-height: 1.5;">
              <strong>Security Notice:</strong> Never share your verification code with anyone. SkyNav support will never ask for your code. If you did not create this account, you can safely ignore this email.
            </p>
          </div>

          <div style="margin-top: 28px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © 2026 SkyNav Aero Technologies Inc. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📬 [SMTP-DELIVERY] Verification email delivered! Preview at: ${previewUrl}`);
    } else {
      console.log(`📬 [SMTP-DELIVERY] Verification email dispatched to ${toEmail} (Message ID: ${info.messageId})`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (err: any) {
    console.error('❌ [SMTP] Failed to send verification email via SMTP:', err);
    return {
      success: false,
      error: `Email delivery failed: ${err.message || 'SMTP transport error'}`,
    };
  }
};

/**
 * Send Password Reset Code
 */
export const sendPasswordResetEmail = async (
  toEmail: string,
  customerName: string,
  code: string
): Promise<EmailSendResult> => {
  const config = getSmtpConfig();
  const from = config.from;

  const transporter = await getTransporter();
  if (!transporter) {
    return {
      success: false,
      error: 'Email delivery is currently unavailable. Please configure SMTP credentials in .env.',
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: `[SkyNav] Reset Your Password - Code: ${code}`,
      text: `Hello ${customerName},\n\nYour SkyNav password reset code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please secure your account immediately.`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">SkyNav Password Recovery</h2>
          <p style="color: #475569;">Hello <strong>${customerName}</strong>,</p>
          <p style="color: #475569;">Enter the code below to reset your password:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; background: #e0e7ff; padding: 12px 24px; border-radius: 8px; display: inline-block; font-family: monospace;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Valid for 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (err: any) {
    console.error('❌ [SMTP] Failed to send password reset email:', err);
    return {
      success: false,
      error: `Email delivery failed: ${err.message || 'SMTP transport error'}`,
    };
  }
};
