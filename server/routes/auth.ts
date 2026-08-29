import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, queryOne, queryAll, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'skylink_super_secure_jwt_secret_2026_aerodelivery';

// Helper to generate JWT token
const generateToken = (userId: string, email: string): string => {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
};

// Generate cryptographically random 6-digit numeric OTP
const generate6DigitCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 1. REGISTER
router.post('/register', async (req, res): Promise<void> => {
  try {
    const { name, email, phone, password, confirmPassword, acceptTerms } = req.body;

    if (!name || !email || !phone || !password) {
      res.status(400).json({ error: 'Please provide all required fields (name, email, phone, password).' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    if (!acceptTerms) {
      res.status(400).json({ error: 'You must accept the Terms & Conditions.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = queryOne<any>('SELECT id, is_verified FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
      return;
    }

    const userId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = generate6DigitCode();
    const codeHash = await bcrypt.hash(verificationCode, 8);
    const tokenId = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Dispatch verification email first
    const emailResult = await sendVerificationEmail(cleanEmail, name.trim(), verificationCode);

    if (!emailResult.success) {
      res.status(500).json({
        error: emailResult.error || 'We could not send the verification email. Please check your email configuration or try again.',
      });
      return;
    }

    // Transaction to create pending user, notification preferences, cart, wishlist, and token
    db.transaction(() => {
      // Create user in pending_verification state
      runCommand(`
        INSERT INTO users (id, name, email, phone, password_hash, is_verified, account_status)
        VALUES (?, ?, ?, ?, ?, 0, 'pending_verification')
      `, [userId, name.trim(), cleanEmail, phone.trim(), passwordHash]);

      // Create notification preferences
      runCommand(`
        INSERT INTO notification_preferences (user_id, email_updates, sms_alerts, drone_proximity_sound)
        VALUES (?, 1, 1, 1)
      `, [userId]);

      // Initialize Cart & Wishlist
      runCommand(`INSERT INTO carts (id, customer_id) VALUES (?, ?)`, [`cart_${userId}`, userId]);
      runCommand(`INSERT INTO wishlists (id, customer_id) VALUES (?, ?)`, [`wish_${userId}`, userId]);

      // Insert verification token (10-minute expiry)
      runCommand(`
        INSERT INTO verification_tokens (id, user_id, type, code_hash, expires_at, attempt_count, max_attempts)
        VALUES (?, ?, 'email_verification', ?, datetime('now', '+10 minutes'), 0, 5)
      `, [tokenId, userId, codeHash]);
    })();

    const user = queryOne<any>(
      'SELECT id, name, email, phone, avatar, is_verified as isVerified, account_status as accountStatus, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?',
      [userId]
    );

    const token = generateToken(userId, cleanEmail);

    res.status(201).json({
      message: 'Account created. We have sent a 6-digit verification code to your email address.',
      user: {
        ...user,
        isVerified: false,
      },
      token,
      requiresVerification: true,
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// 2. VERIFY ACCOUNT
router.post('/verify-account', async (req, res): Promise<void> => {
  try {
    const { code, email } = req.body;

    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      res.status(400).json({ error: 'Please enter a valid 6-digit verification code.' });
      return;
    }

    // Identify user by email FIRST (authoritative for verification flow)
    let userId: string | null = null;
    if (email && typeof email === 'string' && email.trim() !== '') {
      const userByEmail = queryOne<any>('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      if (userByEmail) userId = userByEmail.id;
    }

    if (!userId) {
      let authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
          userId = decoded.id;
        } catch {}
      }
    }

    if (!userId) {
      res.status(400).json({ error: 'Unable to identify account. Please provide your registered email address.' });
      return;
    }

    // Find latest active verification token for this user
    const tokenRecord = queryOne<any>(`
      SELECT * FROM verification_tokens
      WHERE user_id = ? AND type = 'email_verification' AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (!tokenRecord) {
      res.status(400).json({ error: 'No active verification code found. Please request a new code.' });
      return;
    }

    // Check expiration
    const expiresAt = new Date(tokenRecord.expires_at).getTime();
    if (Date.now() > expiresAt) {
      res.status(400).json({ error: 'Verification code has expired. Please click Resend Code to receive a fresh code.' });
      return;
    }

    // Check maximum attempts
    if (tokenRecord.attempt_count >= tokenRecord.max_attempts) {
      res.status(429).json({ error: 'Too many incorrect attempts. Please request a new verification code.' });
      return;
    }

    // Verify code
    const isMatch = await bcrypt.compare(code.trim(), tokenRecord.code_hash);
    if (!isMatch) {
      runCommand(`
        UPDATE verification_tokens
        SET attempt_count = attempt_count + 1
        WHERE id = ?
      `, [tokenRecord.id]);

      const remaining = tokenRecord.max_attempts - (tokenRecord.attempt_count + 1);
      res.status(400).json({
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code invalidated. Please request a new one.'}`
      });
      return;
    }

    // Mark as verified & activate user account in a transaction
    db.transaction(() => {
      runCommand(`
        UPDATE verification_tokens
        SET verified_at = datetime('now'), used_at = datetime('now')
        WHERE id = ?
      `, [tokenRecord.id]);

      runCommand(`
        UPDATE users
        SET is_verified = 1, account_status = 'active', updated_at = datetime('now')
        WHERE id = ?
      `, [userId]);

      // Welcome Notification
      runCommand(`
        INSERT INTO notifications (id, customer_id, title, message, type, is_read, event_id)
        VALUES (?, ?, 'Email Verified 🎉', 'Welcome to SkyLink Aero Store! Your email is verified and your account is ready for drone deliveries.', 'system', 0, ?)
      `, [`notif_verif_${userId}`, userId, `evt_verified_${userId}`]);
    })();

    const updatedUser = queryOne<any>(
      'SELECT id, name, email, phone, avatar, is_verified as isVerified, account_status as accountStatus, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?',
      [userId]
    );

    const prefs = queryOne<any>(
      'SELECT email_updates as emailUpdates, sms_alerts as smsAlerts, drone_proximity_sound as droneProximitySound FROM notification_preferences WHERE user_id = ?',
      [userId]
    );

    const fullUser = {
      ...updatedUser,
      isVerified: true,
      notificationPreferences: prefs || { emailUpdates: true, smsAlerts: true, droneProximitySound: true }
    };

    const freshToken = generateToken(updatedUser.id, updatedUser.email);

    res.json({
      success: true,
      message: 'Email successfully verified! Welcome to SkyLink.',
      user: fullUser,
      token: freshToken
    });
  } catch (err: any) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

// 3. RESEND VERIFICATION CODE
router.post('/resend-verification', async (req, res): Promise<void> => {
  try {
    const { email } = req.body;

    let user: any = null;
    if (email && typeof email === 'string' && email.trim() !== '') {
      user = queryOne<any>('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    }

    if (!user) {
      let authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
          user = queryOne<any>('SELECT * FROM users WHERE id = ?', [decoded.id]);
        } catch {}
      }
    }

    if (!user) {
      res.status(400).json({ error: 'User account not found. Please register first.' });
      return;
    }

    if (user.is_verified === 1) {
      res.status(400).json({ error: 'This account has already been verified. Please sign in.' });
      return;
    }

    // Rate limiting: Check if a token was created in the last 45 seconds
    const recentToken = queryOne<any>(`
      SELECT * FROM verification_tokens
      WHERE user_id = ? AND type = 'email_verification'
      ORDER BY created_at DESC
      LIMIT 1
    `, [user.id]);

    if (recentToken) {
      const createdAt = new Date(recentToken.created_at).getTime();
      const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);
      if (elapsedSeconds < 45) {
        res.status(429).json({
          error: `Please wait ${45 - elapsedSeconds}s before requesting another verification code.`
        });
        return;
      }
    }

    // Generate new code
    const newCode = generate6DigitCode();
    const codeHash = await bcrypt.hash(newCode, 8);
    const tokenId = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const emailResult = await sendVerificationEmail(user.email, user.name, newCode);
    if (!emailResult.success) {
      res.status(500).json({ error: emailResult.error || 'Failed to dispatch email.' });
      return;
    }

    // Invalidate previous tokens
    runCommand(`
      UPDATE verification_tokens
      SET used_at = datetime('now')
      WHERE user_id = ? AND type = 'email_verification' AND used_at IS NULL
    `, [user.id]);

    runCommand(`
      INSERT INTO verification_tokens (id, user_id, type, code_hash, expires_at, attempt_count, max_attempts)
      VALUES (?, ?, 'email_verification', ?, datetime('now', '+10 minutes'), 0, 5)
    `, [tokenId, user.id, codeHash]);

    res.json({
      success: true,
      message: 'A fresh 6-digit verification code has been dispatched to your email.',
    });
  } catch (err: any) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code.' });
  }
});

// 4. LOGIN
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter both your email address and password.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRow = queryOne<any>('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!userRow) {
      res.status(401).json({ error: 'Invalid email or password. Please check your credentials.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, userRow.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password. Please check your credentials.' });
      return;
    }

    if (userRow.account_status === 'disabled') {
      res.status(403).json({ error: 'Your customer account has been suspended. Please contact support.' });
      return;
    }

    // If user has not verified email yet, prompt them to verify
    if (userRow.is_verified === 0 || userRow.account_status === 'pending_verification') {
      const tempToken = generateToken(userRow.id, userRow.email);
      res.status(403).json({
        error: 'Please verify your email address to access your account.',
        requiresVerification: true,
        email: userRow.email,
        token: tempToken,
      });
      return;
    }

    const token = generateToken(userRow.id, userRow.email);

    // Fetch preferences
    const prefs = queryOne<any>(
      'SELECT email_updates as emailUpdates, sms_alerts as smsAlerts, drone_proximity_sound as droneProximitySound FROM notification_preferences WHERE user_id = ?',
      [userRow.id]
    );

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      phone: userRow.phone,
      avatar: userRow.avatar,
      isVerified: Boolean(userRow.is_verified),
      accountStatus: userRow.account_status,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
      notificationPreferences: prefs || { emailUpdates: true, smsAlerts: true, droneProximitySound: true }
    };

    res.json({
      message: 'Login successful.',
      user,
      token
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// 5. FORGOT PASSWORD
router.post('/forgot-password', async (req, res): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = queryOne<any>('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    // To prevent email enumeration attacks, always return standard message
    if (!user) {
      res.json({
        success: true,
        message: 'If an account exists with this email, a 6-digit password recovery code has been sent.',
      });
      return;
    }

    // Invalidate old password reset tokens
    runCommand(`
      UPDATE verification_tokens
      SET used_at = datetime('now')
      WHERE user_id = ? AND type = 'password_reset' AND used_at IS NULL
    `, [user.id]);

    // Generate reset code (15-minute expiry)
    const resetCode = generate6DigitCode();
    const codeHash = await bcrypt.hash(resetCode, 8);
    const tokenId = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    runCommand(`
      INSERT INTO verification_tokens (id, user_id, type, code_hash, expires_at, attempt_count, max_attempts)
      VALUES (?, ?, 'password_reset', ?, datetime('now', '+15 minutes'), 0, 5)
    `, [tokenId, user.id, codeHash]);

    const emailResult = await sendPasswordResetEmail(cleanEmail, user.name, resetCode);
    if (!emailResult.success) {
      res.status(500).json({ error: emailResult.error || 'Failed to dispatch password recovery email.' });
      return;
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a 6-digit password recovery code has been sent.',
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password recovery request.' });
  }
});

// 6. RESET PASSWORD
router.post('/reset-password', async (req, res): Promise<void> => {
  try {
    const { email, code, password, confirmPassword } = req.body;

    if (!email || !code || !password || !confirmPassword) {
      res.status(400).json({ error: 'Please provide email, verification code, and new password.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = queryOne<any>('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!user) {
      res.status(400).json({ error: 'Invalid recovery code or email.' });
      return;
    }

    const tokenRecord = queryOne<any>(`
      SELECT * FROM verification_tokens
      WHERE user_id = ? AND type = 'password_reset' AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [user.id]);

    if (!tokenRecord) {
      res.status(400).json({ error: 'No active password recovery code found. Please request a new code.' });
      return;
    }

    // Check expiry
    if (Date.now() > new Date(tokenRecord.expires_at).getTime()) {
      res.status(400).json({ error: 'The password reset code has expired. Please request a new one.' });
      return;
    }

    // Check attempts
    if (tokenRecord.attempt_count >= tokenRecord.max_attempts) {
      res.status(429).json({ error: 'Too many failed attempts. Please request a new recovery code.' });
      return;
    }

    // Verify code
    const isMatch = await bcrypt.compare(code.trim(), tokenRecord.code_hash);
    if (!isMatch) {
      runCommand('UPDATE verification_tokens SET attempt_count = attempt_count + 1 WHERE id = ?', [tokenRecord.id]);
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    // Hash new password and update user in transaction
    const newPasswordHash = await bcrypt.hash(password, 10);

    db.transaction(() => {
      runCommand(`
        UPDATE verification_tokens
        SET verified_at = datetime('now'), used_at = datetime('now')
        WHERE id = ?
      `, [tokenRecord.id]);

      runCommand(`
        UPDATE users
        SET password_hash = ?, is_verified = 1, account_status = 'active', updated_at = datetime('now')
        WHERE id = ?
      `, [newPasswordHash, user.id]);
    })();

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// 7. GET CURRENT PROFILE (AUTHENTICATED)
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userRow = queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (!userRow) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const prefs = queryOne<any>(
      'SELECT email_updates as emailUpdates, sms_alerts as smsAlerts, drone_proximity_sound as droneProximitySound FROM notification_preferences WHERE user_id = ?',
      [userRow.id]
    );

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      phone: userRow.phone,
      avatar: userRow.avatar,
      isVerified: Boolean(userRow.is_verified),
      accountStatus: userRow.account_status,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
      notificationPreferences: prefs || { emailUpdates: true, smsAlerts: true, droneProximitySound: true }
    };

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// 8. UPDATE PROFILE (AUTHENTICATED)
router.put('/profile', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { name, phone, avatar, notificationPreferences } = req.body;
    const userId = req.user!.id;

    db.transaction(() => {
      if (name || phone || avatar !== undefined) {
        runCommand(`
          UPDATE users SET
            name = COALESCE(?, name),
            phone = COALESCE(?, phone),
            avatar = COALESCE(?, avatar),
            updated_at = datetime('now')
          WHERE id = ?
        `, [name?.trim() || null, phone?.trim() || null, avatar || null, userId]);
      }

      if (notificationPreferences) {
        runCommand(`
          INSERT INTO notification_preferences (user_id, email_updates, sms_alerts, drone_proximity_sound)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            email_updates = excluded.email_updates,
            sms_alerts = excluded.sms_alerts,
            drone_proximity_sound = excluded.drone_proximity_sound
        `, [
          userId,
          notificationPreferences.emailUpdates ? 1 : 0,
          notificationPreferences.smsAlerts ? 1 : 0,
          notificationPreferences.droneProximitySound ? 1 : 0
        ]);
      }
    })();

    const updatedUser = queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    const prefs = queryOne<any>('SELECT email_updates as emailUpdates, sms_alerts as smsAlerts, drone_proximity_sound as droneProximitySound FROM notification_preferences WHERE user_id = ?', [userId]);

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar,
      isVerified: Boolean(updatedUser.is_verified),
      accountStatus: updatedUser.account_status,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
      notificationPreferences: prefs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// 9. CHANGE PASSWORD (AUTHENTICATED)
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user!.id;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New passwords do not match.' });
      return;
    }

    const user = queryOne<any>('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (currentPassword) {
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    runCommand("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [newHash, userId]);

    res.json({ success: true, message: 'Password has been updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// 10. LOGOUT
router.post('/logout', (req, res): void => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
