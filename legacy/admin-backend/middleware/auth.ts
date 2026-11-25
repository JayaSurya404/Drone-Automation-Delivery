import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';
import { getAdminEnv } from '../config/env.js';

const ALLOWED_ADMIN_ROLES = new Set([
  'admin',
  'super_admin',
  'ops_admin',
  'fleet_manager',
  'dispatch_manager',
  'support_admin',
  'analytics_admin',
  'analyst',
]);

export interface AuthenticatedAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar?: string;
  status: string;
}

export interface AuthenticatedAdminRequest extends Request {
  admin?: AuthenticatedAdmin;
}

export function verifyAdminJwt(token: string | null | undefined): AuthenticatedAdmin | null {
  if (!token || typeof token !== 'string') return null;

  try {
    const { ADMIN_JWT_SECRET } = getAdminEnv();
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { id?: string; email?: string; role?: string };
    if (!decoded?.id) return null;

    const admin = queryOne<AuthenticatedAdmin>(
      'SELECT id, name, email, role, phone, avatar, status FROM admin_users WHERE id = ?',
      [decoded.id]
    );
    if (!admin || admin.status !== 'Active' || !ALLOWED_ADMIN_ROLES.has(admin.role)) {
      return null;
    }

    return admin;
  } catch {
    return null;
  }
}

export function requireAdmin(req: AuthenticatedAdminRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }

  try {
    const { ADMIN_JWT_SECRET } = getAdminEnv();
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { id?: string };
    if (!decoded?.id) {
      res.status(401).json({ error: 'Invalid admin token.' });
      return;
    }

    const admin = queryOne<AuthenticatedAdmin>(
      'SELECT id, name, email, role, phone, avatar, status FROM admin_users WHERE id = ?',
      [decoded.id]
    );

    if (!admin) {
      res.status(401).json({ error: 'Admin account not found.' });
      return;
    }

    if (admin.status !== 'Active' || !ALLOWED_ADMIN_ROLES.has(admin.role)) {
      res.status(403).json({ error: 'Admin access denied or account inactive.' });
      return;
    }

    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired admin token.' });
  }
}
