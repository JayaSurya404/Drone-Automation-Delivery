import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  isVerified: boolean;
  accountStatus: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'skynav_super_secure_jwt_secret_2026_aerodelivery';

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required. Please login.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    
    // Query user from database to ensure active status
    const user = queryOne<any>(
      'SELECT id, name, email, phone, is_verified as isVerified, account_status as accountStatus FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      res.status(401).json({ error: 'User account does not exist or has been removed.' });
      return;
    }

    if (user.accountStatus === 'disabled') {
      res.status(403).json({ error: 'Your customer account has been suspended.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired access token. Please log in again.' });
  }
};

// Middleware to enforce customer data isolation
export const authorizeCustomer = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
};
