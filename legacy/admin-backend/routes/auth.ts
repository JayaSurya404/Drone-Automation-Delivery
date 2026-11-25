import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';
import { getAdminEnv } from '../config/env.js';
import { requireAdmin, AuthenticatedAdminRequest } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const admin = queryOne<any>('SELECT * FROM admin_users WHERE email = ?', [cleanEmail]);

    if (!admin) {
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }

    // Strictly verify bcrypt password
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }

    const { ADMIN_JWT_SECRET } = getAdminEnv();
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      ADMIN_JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        status: admin.status,
        avatar: admin.avatar,
      },
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

router.get('/me', requireAdmin, (req: AuthenticatedAdminRequest, res: Response): void => {
  res.json({ user: req.admin });
});

export default router;
