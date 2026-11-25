import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';
import { getCustomerEnv } from '../config/env.js';

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

export const verifyCustomerToken = (token: string | null | undefined): { user?: AuthenticatedUser; error?: string; status?: number } => {
  if (!token) {
    return { error: 'Access token required. Please login.', status: 401 };
  }

  try {
    const { JWT_SECRET } = getCustomerEnv();
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };

    const user = queryOne<any>(
      'SELECT id, name, email, phone, is_verified as isVerified, account_status as accountStatus FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return { error: 'User account does not exist or has been removed.', status: 401 };
    }

    if (user.accountStatus === 'disabled') {
      return { error: 'Your customer account has been suspended.', status: 403 };
    }

    return { user };
  } catch {
    return { error: 'Invalid or expired access token. Please log in again.', status: 401 };
  }
};

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const result = verifyCustomerToken(token);

  if (!result.user) {
    res.status(result.status || 401).json({ error: result.error });
    return;
  }

  req.user = result.user;
  next();
};

// Middleware to enforce customer data isolation
export const authorizeCustomer = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
};
