import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'dormfind-dev-secret-key-change-in-production';

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  student_id: string;
  role: 'student' | 'admin';
  block_id: number | null;
  room_number: string;
  phone: string;
  points: number;
  returned_count: number;
  badge_tier: string;
  is_active: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signToken(userId: number, role: 'student' | 'admin'): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    return decoded;
  } catch {
    return null;
  }
}

function getUserById(userId: number): AuthUser | undefined {
  return db
    .prepare(
      `SELECT id, full_name, email, student_id, role, block_id, room_number, phone,
              points, returned_count, badge_tier, is_active
       FROM users WHERE id = ?`
    )
    .get(userId) as AuthUser | undefined;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = getUserById(payload.userId);
      if (user && user.is_active === 1) {
        req.user = user;
      }
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    return;
  }
  const user = getUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  if (user.is_active !== 1) {
    res.status(403).json({ error: 'Your account has been suspended. Contact the hostel warden.' });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Warden or administrator privileges required.' });
    return;
  }
  next();
}
