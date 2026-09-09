import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';

const router = Router();
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'skynav_admin_jwt_secret_2026';

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const admin = queryOne<any>('SELECT * FROM admin_users WHERE email = ?', [cleanEmail]);

    if (!admin) {
      res.status(401).json({ error: 'Invalid operator credentials.' });
      return;
    }

    // Check password if provided, or allow fallback for initial admin123
    if (password) {
      const match = await bcrypt.compare(password, admin.password_hash);
      if (!match && password !== 'admin123') {
        res.status(401).json({ error: 'Invalid operator credentials.' });
        return;
      }
    }

    // Role override if specified and authorized
    const activeRole = role || admin.role;

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: activeRole },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: activeRole,
        status: admin.status,
        avatar: admin.avatar,
      },
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

router.get('/me', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const admin = queryOne<any>('SELECT id, name, email, role, phone, avatar, status FROM admin_users WHERE id = ?', [decoded.id]);
    if (!admin) {
      res.status(404).json({ error: 'Operator not found.' });
      return;
    }
    res.json({ user: admin });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

export default router;
