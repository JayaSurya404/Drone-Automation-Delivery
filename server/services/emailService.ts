import nodemailer from 'nodemailer';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Check if SMTP is configured
export const isSmtpConfigured = (): boolean => {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  return Boolean(host && host.trim() !== '' && user && user.trim() !== '' && pass && pass.trim() !== '');
};

const getTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = port === 465;
  const isGmail = (process.env.EMAIL_HOST || '').includes('gmail');

  return nodemailer.createTransport({
    ...(isGmail ? { service: 'gmail' } : { host: process.env.EMAIL_HOST, port, secure }),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Send 6-digit Email Verification Code
 */
export const sendVerificationEmail = async (
  toEmail: string,
  customerName: string,
  code: string
): Promise<EmailSendResult> => {
  const from = process.env.EMAIL_FROM || 'SkyLink Aero Store <no-reply@skylink-aero.com>';

  if (!isSmtpConfigured()) {
    console.error(`[EMAIL SERVICE] Failed: SMTP credentials missing in .env for sending to ${toEmail}`);
    return {
      success: false,
      error: 'Email verification service is currently unavailable. Please configure EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD in .env to enable real email delivery.',
    };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Verify Your SkyLink Account - Code ${code}`,
      text: `Hello ${customerName},\n\nYour SkyLink verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nThank you for choosing SkyLink Autonomous Drone Delivery!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0;">SkyLink Aero Delivery</h1>
            <p style="color: #64748b; font-size: 14px; margin: 4px 0 0;">Autonomous Drone Logistics & Instant Store</p>
          </div>
          <div style="padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center;">
            <p style="color: #334155; font-size: 15px; margin: 0 0 12px;">Hello <strong>${customerName}</strong>,</p>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">Use the verification code below to activate your customer account:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0284c7; background: #e0f2fe; padding: 12px 24px; border-radius: 8px; display: inline-block; font-family: monospace;">
              ${code}
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0;">This code is valid for 10 minutes. If you did not create this account, please ignore this email.</p>
          </div>
        </div>
      `,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    console.error('Failed to send verification email via SMTP:', err);
    return {
      success: false,
      error: `Email delivery failed: ${err.message || 'SMTP connection error'}`,
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
  const from = process.env.EMAIL_FROM || 'SkyLink Aero Store <no-reply@skylink-aero.com>';

  if (!isSmtpConfigured()) {
    console.error(`[EMAIL SERVICE] Failed: SMTP credentials missing in .env for password reset to ${toEmail}`);
    return {
      success: false,
      error: 'Password reset email service is currently unavailable. Please configure EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD in .env.',
    };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Reset Your SkyLink Password - Code ${code}`,
      text: `Hello ${customerName},\n\nYour password reset code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please secure your account immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0;">SkyLink Aero Delivery</h1>
            <p style="color: #64748b; font-size: 14px; margin: 4px 0 0;">Password Recovery Request</p>
          </div>
          <div style="padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center;">
            <p style="color: #334155; font-size: 15px; margin: 0 0 12px;">Hello <strong>${customerName}</strong>,</p>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">Enter the code below to reset your customer account password:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; background: #e0e7ff; padding: 12px 24px; border-radius: 8px; display: inline-block; font-family: monospace;">
              ${code}
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0;">This code is valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>
          </div>
        </div>
      `,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    console.error('Failed to send password reset email via SMTP:', err);
    return {
      success: false,
      error: `Email delivery failed: ${err.message || 'SMTP connection error'}`,
    };
  }
};
