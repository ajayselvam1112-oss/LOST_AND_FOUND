import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Response, Router } from 'express';
import express from 'express';
import { z } from 'zod';
import {
  type AuthenticatedRequest,
  optionalAuth,
  requireAdmin,
  requireAuth,
  signToken,
} from './auth.ts';
import { computeBadgeTier, db, uploadsDir } from './db.ts';

const VALID_CATEGORIES = [
  'Electronics',
  'ID & Keys',
  'Wallet & Cards',
  'Books & Notes',
  'Clothing',
  'Accessories',
  'Sports & Gear',
  'Other',
] as const;

const VALID_STATUSES = [
  'Lost',
  'Found',
  'Verification Pending',
  'Claimed',
  'Returned',
  'Closed',
] as const;

const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(80),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  student_id: z.string().trim().min(4, 'Student ID must be at least 4 characters').max(30),
  block_id: z.coerce.number().int().positive('Please select your hostel block'),
  room_number: z.string().trim().min(1, 'Room number is required').max(20),
  phone: z.string().trim().min(7, 'Valid contact number is required').max(20),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const createItemSchema = z.object({
  type: z.enum(['lost', 'found']),
  title: z.string().trim().min(3, 'Item name must be at least 3 characters').max(100),
  category: z.enum(VALID_CATEGORIES),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(1000),
  secret_detail: z.string().trim().max(400).optional().default(''),
  image_url: z.string().trim().max(500).optional().default(''),
  block_id: z.coerce.number().int().positive('Select a hostel block'),
  floor: z.string().trim().min(1, 'Floor is required').max(40),
  location_vicinity: z.string().trim().min(3, 'Location vicinity is required').max(120),
  gps_lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  gps_lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  incident_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date (YYYY-MM-DD) is required'),
  incident_time: z.string().regex(/^\d{2}:\d{2}$/, 'Valid time (HH:MM) is required'),
  finder_contact_note: z.string().trim().max(250).optional().default(''),
});

const statusUpdateSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

const createClaimSchema = z.object({
  claim_type: z.enum(['claim_found_item', 'report_found_for_lost']),
  verification_answer: z
    .string()
    .trim()
    .min(12, 'Please provide specific identifying details (at least 12 characters)')
    .max(800),
  supporting_evidence_url: z.string().trim().max(500).optional().default(''),
  supporting_notes: z.string().trim().max(400).optional().default(''),
});

const reviewClaimSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewer_notes: z.string().trim().max(400).optional().default(''),
});

const completeClaimSchema = z.object({
  handover_code: z.string().trim().max(20).optional().default(''),
});

const createComplaintSchema = z.object({
  item_id: z.coerce.number().int().positive().nullable().optional(),
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(120),
  details: z.string().trim().min(12, 'Please explain the issue clearly (min 12 characters)').max(1200),
});

const adminUpdateUserSchema = z.object({
  is_active: z.boolean().optional(),
  role: z.enum(['student', 'admin']).optional(),
});

const adminUpdateComplaintSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'dismissed']),
  admin_response: z.string().trim().max(600).optional().default(''),
});

function formatValidationError(err: z.ZodError): string {
  const first = err.issues[0];
  return first ? first.message : 'Invalid input provided';
}

function awardPoints(userId: number, itemId: number | null, points: number, reason: string, incrementReturn = false): void {
  const user = db.prepare('SELECT points, returned_count FROM users WHERE id = ?').get(userId) as
    | { points: number; returned_count: number }
    | undefined;
  if (!user) return;
  const nextPoints = Math.max(0, user.points + points);
  const nextReturns = incrementReturn ? user.returned_count + 1 : user.returned_count;
  const nextTier = computeBadgeTier(nextPoints);

  db.prepare('UPDATE users SET points = ?, returned_count = ?, badge_tier = ? WHERE id = ?').run(
    nextPoints,
    nextReturns,
    nextTier,
    userId
  );
  db.prepare('INSERT INTO point_logs (user_id, item_id, points, reason) VALUES (?, ?, ?, ?)').run(
    userId,
    itemId,
    points,
    reason
  );
}

function createNotification(
  userId: number,
  title: string,
  message: string,
  category: 'match' | 'claim' | 'verification' | 'return' | 'system',
  relatedItemId: number | null = null
): void {
  db.prepare(
    'INSERT INTO notifications (user_id, title, message, category, related_item_id) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, title, message, category, relatedItemId);
}

function runSmartMatch(newItemId: number, newItem: {
  type: 'lost' | 'found';
  title: string;
  category: string;
  block_id: number;
  reporter_id: number;
  tracking_code: string;
}): void {
  const oppositeType = newItem.type === 'lost' ? 'found' : 'lost';
  const activeOppositeStatus = oppositeType === 'found' ? 'Found' : 'Lost';

  const candidates = db
    .prepare(
      `SELECT id, tracking_code, title, category, block_id, reporter_id
       FROM items
       WHERE type = ? AND status IN (?, 'Verification Pending') AND reporter_id != ?`
    )
    .all(oppositeType, activeOppositeStatus, newItem.reporter_id) as Array<{
      id: number;
      tracking_code: string;
      title: string;
      category: string;
      block_id: number;
      reporter_id: number;
    }>;

  const keywords = newItem.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

  for (const cand of candidates) {
    let score = 0;
    if (cand.category === newItem.category) score += 2;
    if (cand.block_id === newItem.block_id) score += 2;
    const candTitle = cand.title.toLowerCase();
    const matchedWords = keywords.filter((kw) => candTitle.includes(kw));
    score += matchedWords.length * 2;

    if (score >= 4) {
      createNotification(
        newItem.reporter_id,
        `Potential match found (${cand.tracking_code})`,
        `"${cand.title}" in the same category/vicinity might match your report "${newItem.title}". Open the item to verify details.`,
        'match',
        cand.id
      );
      createNotification(
        cand.reporter_id,
        `New possible match (${newItem.tracking_code})`,
        `A student just posted "${newItem.title}" which closely matches your report "${cand.title}".`,
        'match',
        newItemId
      );
    }
  }
}

function sanitizeUser(user: {
  id: number;
  full_name: string;
  email: string;
  student_id: string;
  role: string;
  block_id: number | null;
  room_number: string;
  phone: string;
  points: number;
  returned_count: number;
  badge_tier: string;
  is_active: number;
}) {
  const block = user.block_id
    ? (db.prepare('SELECT id, code, name FROM hostel_blocks WHERE id = ?').get(user.block_id) as
        | { id: number; code: string; name: string }
        | undefined)
    : undefined;

  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    student_id: user.student_id,
    role: user.role,
    block_id: user.block_id,
    block_name: block?.name || 'Campus Desk',
    block_code: block?.code || 'HQ',
    room_number: user.room_number,
    phone: user.phone,
    points: user.points,
    returned_count: user.returned_count,
    badge_tier: user.badge_tier,
  };
}

export function createApiRouter(): Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    try {
      const row = db.prepare('SELECT 1 as ok').get() as { ok: number };
      res.json({ status: 'ok', database: row.ok === 1 });
    } catch {
      res.status(500).json({ status: 'error', database: false });
    }
  });

  // Auth routes
  router.post('/auth/register', (req, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatValidationError(parsed.error) });
        return;
      }

      const data = parsed.data;
      const normalizedEmail = data.email.toLowerCase();
      const normalizedStudentId = data.student_id.toUpperCase();

      const existingEmail = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
        .get(normalizedEmail);
      if (existingEmail) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const existingSid = db
        .prepare('SELECT id FROM users WHERE UPPER(student_id) = ?')
        .get(normalizedStudentId);
      if (existingSid) {
        res.status(409).json({ error: 'This Student ID is already registered.' });
        return;
      }

      const block = db.prepare('SELECT id FROM hostel_blocks WHERE id = ?').get(data.block_id);
      if (!block) {
        res.status(400).json({ error: 'Selected hostel block does not exist.' });
        return;
      }

      const passwordHash = bcrypt.hashSync(data.password, 10);
      const result = db
        .prepare(
          `INSERT INTO users (full_name, email, password_hash, student_id, role, block_id, room_number, phone, points, returned_count, badge_tier)
           VALUES (?, ?, ?, ?, 'student', ?, ?, ?, 0, 0, 'Campus Helper')`
        )
        .run(
          data.full_name,
          normalizedEmail,
          passwordHash,
          normalizedStudentId,
          data.block_id,
          data.room_number,
          data.phone
        );

      const userId = Number(result.lastInsertRowid);
      createNotification(
        userId,
        'Welcome to DormFind',
        'Your hostel student account is active. You can now report lost items, register found belongings, and verify claims safely.',
        'system',
        null
      );

      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      const token = signToken(userId, 'student');
      res.status(201).json({ token, user: sanitizeUser(userRow) });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Unable to create account right now. Please try again.' });
    }
  });

  router.post('/auth/login', (req, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: formatValidationError(parsed.error) });
        return;
      }

      const { email, password } = parsed.data;
      const userRow = db
        .prepare('SELECT * FROM users WHERE LOWER(email) = ?')
        .get(email.toLowerCase()) as any;
      if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      if (userRow.is_active !== 1) {
        res.status(403).json({ error: 'Your account has been suspended. Please contact the hostel warden.' });
        return;
      }

      const token = signToken(userRow.id, userRow.role);
      res.json({ token, user: sanitizeUser(userRow) });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  router.post('/auth/logout', (_req, res: Response) => {
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: sanitizeUser(req.user!) });
  });

  // Hostel Blocks
  router.get('/blocks', (_req, res: Response) => {
    try {
      const blocks = db
        .prepare(
          `SELECT b.*,
                  SUM(CASE WHEN i.status = 'Lost' THEN 1 ELSE 0 END) as lost_count,
                  SUM(CASE WHEN i.status IN ('Found', 'Verification Pending') THEN 1 ELSE 0 END) as found_count,
                  SUM(CASE WHEN i.status = 'Returned' THEN 1 ELSE 0 END) as returned_count,
                  COUNT(i.id) as total_items
           FROM hostel_blocks b
           LEFT JOIN items i ON i.block_id = b.id
           GROUP BY b.id
           ORDER BY b.id ASC`
        )
        .all();
      res.json({ blocks });
    } catch (err) {
      console.error('Blocks error:', err);
      res.status(500).json({ error: 'Unable to load hostel blocks.' });
    }
  });

  // Image upload (local verified storage)
  router.post('/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as { dataUrl?: string };
    if (!body?.dataUrl || typeof body.dataUrl !== 'string') {
      res.status(400).json({ error: 'No image data provided.' });
      return;
    }

    const match = body.dataUrl.match(/^data:(image\/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      res.status(400).json({ error: 'Unsupported image format. Please upload a JPEG, PNG, or WebP photo.' });
      return;
    }

    const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
    const buffer = Buffer.from(match[3], 'base64');
    if (buffer.byteLength > 3 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must be 3 MB or smaller.' });
      return;
    }

    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const targetPath = path.join(uploadsDir, filename);
    fs.writeFileSync(targetPath, buffer);

    res.status(201).json({ url: `/uploads/${filename}` });
  });

  // Items listing & smart search
  router.get('/items', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const blockId = typeof req.query.block_id === 'string' ? Number(req.query.block_id) : 0;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';
    const mine = req.query.mine === 'true';

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (q) {
      where.push(
        '(i.title LIKE ? OR i.description LIKE ? OR i.location_vicinity LIKE ? OR i.tracking_code LIKE ?)'
      );
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern, pattern);
    }
    if (type === 'lost' || type === 'found') {
      where.push('i.type = ?');
      params.push(type);
    }
    if (category && category !== 'All') {
      where.push('i.category = ?');
      params.push(category);
    }
    if (blockId > 0) {
      where.push('i.block_id = ?');
      params.push(blockId);
    }
    if (status && status !== 'All') {
      where.push('i.status = ?');
      params.push(status);
    }
    if (dateFrom) {
      where.push('i.incident_date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push('i.incident_date <= ?');
      params.push(dateTo);
    }
    if (mine) {
      if (!req.user) {
        res.status(401).json({ error: 'Sign in to filter by your own reports.' });
        return;
      }
      where.push('i.reporter_id = ?');
      params.push(req.user.id);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT i.id, i.tracking_code, i.type, i.title, i.category, i.description,
                i.image_url, i.block_id, i.floor, i.location_vicinity,
                i.gps_lat, i.gps_lng,
                i.incident_date, i.incident_time, i.status, i.reporter_id,
                i.finder_contact_note, i.created_at, i.updated_at,
                b.name as block_name, b.code as block_code, b.warden_desk,
                u.full_name as reporter_name, u.badge_tier as reporter_badge,
                (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id AND c.status = 'pending') as pending_claims_count
         FROM items i
         JOIN hostel_blocks b ON b.id = i.block_id
         JOIN users u ON u.id = i.reporter_id
         ${whereClause}
         ORDER BY i.created_at DESC, i.id DESC`
      )
      .all(...params) as any[];

    const items = rows.map((row) => ({
      ...row,
      is_owner: req.user ? row.reporter_id === req.user.id : false,
    }));

    res.json({ items });
  });

  // Item detail (strictly protects secret_detail and private student contacts)
  router.get('/items/:id', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      res.status(400).json({ error: 'Invalid item ID.' });
      return;
    }

    const item = db
      .prepare(
        `SELECT i.*, b.name as block_name, b.code as block_code, b.warden_name, b.warden_desk,
                u.full_name as reporter_name, u.badge_tier as reporter_badge,
                rb.name as reporter_block_name
         FROM items i
         JOIN hostel_blocks b ON b.id = i.block_id
         JOIN users u ON u.id = i.reporter_id
         LEFT JOIN hostel_blocks rb ON rb.id = u.block_id
         WHERE i.id = ?`
      )
      .get(itemId) as any;

    if (!item) {
      res.status(404).json({ error: 'Item report not found.' });
      return;
    }

    const isOwner = req.user ? item.reporter_id === req.user.id : false;
    const isAdmin = req.user?.role === 'admin';

    let userClaim: any = null;
    if (req.user) {
      userClaim = db
        .prepare(
          `SELECT id, status, verification_answer, supporting_evidence_url, supporting_notes,
                  reviewer_notes, handover_code, created_at, updated_at
           FROM claims
           WHERE item_id = ? AND claimant_id = ?
           ORDER BY id DESC LIMIT 1`
        )
        .get(itemId, req.user.id);
    }

    let claimsForReviewer: any[] = [];
    if (isOwner || isAdmin) {
      claimsForReviewer = db
        .prepare(
          `SELECT c.*, u.full_name as claimant_name, u.student_id as claimant_student_id,
                  u.badge_tier as claimant_badge, b.name as claimant_block_name
           FROM claims c
           JOIN users u ON u.id = c.claimant_id
           LEFT JOIN hostel_blocks b ON b.id = u.block_id
           WHERE c.item_id = ?
           ORDER BY c.created_at DESC`
        )
        .all(itemId);
    }

    const canSeeContactNote =
      isOwner ||
      isAdmin ||
      (userClaim && (userClaim.status === 'approved' || userClaim.status === 'completed'));

    res.json({
      item: {
        id: item.id,
        tracking_code: item.tracking_code,
        type: item.type,
        title: item.title,
        category: item.category,
        description: item.description,
        secret_detail: isOwner || isAdmin ? item.secret_detail : undefined,
        has_secret_detail: Boolean(item.secret_detail),
        image_url: item.image_url,
        block_id: item.block_id,
        block_name: item.block_name,
        block_code: item.block_code,
        warden_name: item.warden_name,
        warden_desk: item.warden_desk,
        floor: item.floor,
        location_vicinity: item.location_vicinity,
        gps_lat: item.gps_lat,
        gps_lng: item.gps_lng,
        incident_date: item.incident_date,
        incident_time: item.incident_time,
        status: item.status,
        reporter_id: item.reporter_id,
        reporter_name: item.reporter_name,
        reporter_badge: item.reporter_badge,
        reporter_block_name: item.reporter_block_name || item.block_name,
        finder_contact_note: canSeeContactNote
          ? item.finder_contact_note
          : `Protected until ownership verification is approved. Handover coordinated via ${item.warden_desk}.`,
        created_at: item.created_at,
        updated_at: item.updated_at,
        is_owner: isOwner,
      },
      user_claim: userClaim,
      claims: claimsForReviewer,
    });
  });

  // Create Lost or Found item report
  router.post('/items', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    const data = parsed.data;
    const block = db
      .prepare('SELECT id, warden_desk, gps_lat, gps_lng FROM hostel_blocks WHERE id = ?')
      .get(data.block_id) as
      | { id: number; warden_desk: string; gps_lat: number; gps_lng: number }
      | undefined;
    if (!block) {
      res.status(400).json({ error: 'Selected hostel block does not exist.' });
      return;
    }

    const maxIdRow = db.prepare('SELECT COALESCE(MAX(id), 0) as max_id FROM items').get() as { max_id: number };
    const trackingCode = `DF-${1001 + maxIdRow.max_id}`;
    const initialStatus = data.type === 'lost' ? 'Lost' : 'Found';
    const safeContactNote =
      data.finder_contact_note ||
      `Coordinate handover safely at ${block.warden_desk} after verification.`;
    const finalLat = data.gps_lat ?? block.gps_lat;
    const finalLng = data.gps_lng ?? block.gps_lng;

    const result = db
      .prepare(
        `INSERT INTO items (
          tracking_code, type, title, category, description, secret_detail, image_url,
          block_id, floor, location_vicinity, gps_lat, gps_lng, incident_date, incident_time, status,
          reporter_id, finder_contact_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        trackingCode,
        data.type,
        data.title,
        data.category,
        data.description,
        data.secret_detail,
        data.image_url,
        data.block_id,
        data.floor,
        data.location_vicinity,
        finalLat,
        finalLng,
        data.incident_date,
        data.incident_time,
        initialStatus,
        req.user!.id,
        safeContactNote
      );

    const newItemId = Number(result.lastInsertRowid);

    if (data.type === 'found') {
      awardPoints(req.user!.id, newItemId, 10, `Registered found item ${trackingCode}`);
    }

    runSmartMatch(newItemId, {
      type: data.type,
      title: data.title,
      category: data.category,
      block_id: data.block_id,
      reporter_id: req.user!.id,
      tracking_code: trackingCode,
    });

    const created = db
      .prepare(
        `SELECT i.*, b.name as block_name, b.code as block_code, b.warden_desk,
                u.full_name as reporter_name, u.badge_tier as reporter_badge
         FROM items i
         JOIN hostel_blocks b ON b.id = i.block_id
         JOIN users u ON u.id = i.reporter_id
         WHERE i.id = ?`
      )
      .get(newItemId);

    res.status(201).json({ item: created });
  });

  // Update Item Status
  router.patch('/items/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const itemId = Number(req.params.id);
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
    if (!item) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }

    const isOwner = item.reporter_id === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Only the reporter or hostel warden can update item status.' });
      return;
    }

    const nextStatus = parsed.data.status;
    db.prepare(`UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(nextStatus, itemId);

    if (nextStatus === 'Returned' && item.status !== 'Returned' && item.type === 'found') {
      awardPoints(item.reporter_id, itemId, 50, `Completed verified return of ${item.tracking_code}`, true);
    }

    res.json({ ok: true, status: nextStatus });
  });

  // Submit Ownership Claim or Report Found for a Lost Item
  router.post('/items/:id/claims', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const itemId = Number(req.params.id);
    const parsed = createClaimSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
    if (!item) {
      res.status(404).json({ error: 'Item report not found.' });
      return;
    }

    if (item.reporter_id === req.user!.id) {
      res.status(400).json({ error: 'You cannot submit a claim on your own report.' });
      return;
    }

    if (item.status === 'Returned' || item.status === 'Closed' || item.status === 'Claimed') {
      res.status(400).json({ error: `This item is already marked as ${item.status} and is no longer accepting claims.` });
      return;
    }

    const existingPending = db
      .prepare(`SELECT id FROM claims WHERE item_id = ? AND claimant_id = ? AND status IN ('pending', 'approved')`)
      .get(itemId, req.user!.id);
    if (existingPending) {
      res.status(409).json({ error: 'You already have an active verification request for this item.' });
      return;
    }

    const data = parsed.data;
    const result = db
      .prepare(
        `INSERT INTO claims (item_id, claimant_id, claim_type, verification_answer, supporting_evidence_url, supporting_notes, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(
        itemId,
        req.user!.id,
        data.claim_type,
        data.verification_answer,
        data.supporting_evidence_url,
        data.supporting_notes
      );

    db.prepare(`UPDATE items SET status = 'Verification Pending', updated_at = datetime('now') WHERE id = ?`).run(
      itemId
    );

    const actionWord =
      data.claim_type === 'claim_found_item' ? 'submitted an ownership claim' : 'reported finding your lost item';
    createNotification(
      item.reporter_id,
      `Verification pending for ${item.tracking_code}`,
      `${req.user!.full_name} ${actionWord} for "${item.title}". Review their verification details before approving.`,
      'claim',
      itemId
    );

    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ claim });
  });

  // Get claims relevant to the user (incoming on my reports + outgoing submitted by me; admin gets all)
  router.get('/claims', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const isAdmin = req.user!.role === 'admin';
    const userId = req.user!.id;

    const query = isAdmin
      ? `SELECT c.*, i.tracking_code, i.title as item_title, i.type as item_type, i.status as item_status,
                i.secret_detail, i.image_url as item_image_url, i.reporter_id,
                b.name as block_name, b.warden_desk,
                cu.full_name as claimant_name, cu.student_id as claimant_student_id, cu.badge_tier as claimant_badge,
                ru.full_name as reporter_name
         FROM claims c
         JOIN items i ON i.id = c.item_id
         JOIN hostel_blocks b ON b.id = i.block_id
         JOIN users cu ON cu.id = c.claimant_id
         JOIN users ru ON ru.id = i.reporter_id
         ORDER BY c.created_at DESC`
      : `SELECT c.*, i.tracking_code, i.title as item_title, i.type as item_type, i.status as item_status,
                CASE WHEN i.reporter_id = ? THEN i.secret_detail ELSE '' END as secret_detail,
                i.image_url as item_image_url, i.reporter_id,
                b.name as block_name, b.warden_desk,
                cu.full_name as claimant_name, cu.student_id as claimant_student_id, cu.badge_tier as claimant_badge,
                ru.full_name as reporter_name
         FROM claims c
         JOIN items i ON i.id = c.item_id
         JOIN hostel_blocks b ON b.id = i.block_id
         JOIN users cu ON cu.id = c.claimant_id
         JOIN users ru ON ru.id = i.reporter_id
         WHERE c.claimant_id = ? OR i.reporter_id = ?
         ORDER BY c.created_at DESC`;

    const claims = isAdmin
      ? db.prepare(query).all()
      : db.prepare(query).all(userId, userId, userId);

    res.json({ claims });
  });

  // Review (Approve or Reject) Claim
  router.patch('/claims/:id/review', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const claimId = Number(req.params.id);
    const parsed = reviewClaimSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    const claim = db
      .prepare(
        `SELECT c.*, i.reporter_id, i.tracking_code, i.title as item_title, i.type as item_type,
                b.warden_desk
         FROM claims c
         JOIN items i ON i.id = c.item_id
         JOIN hostel_blocks b ON b.id = i.block_id
         WHERE c.id = ?`
      )
      .get(claimId) as any;

    if (!claim) {
      res.status(404).json({ error: 'Claim not found.' });
      return;
    }

    const isOwner = claim.reporter_id === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Only the item reporter or hostel warden can verify this claim.' });
      return;
    }

    if (claim.status !== 'pending') {
      res.status(400).json({ error: `This claim has already been ${claim.status}.` });
      return;
    }

    const { decision, reviewer_notes } = parsed.data;

    if (decision === 'approved') {
      const handoverCode = `DF${crypto.randomInt(1000, 9999)}`;
      db.prepare(
        `UPDATE claims
         SET status = 'approved', reviewer_id = ?, reviewer_notes = ?, handover_code = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(req.user!.id, reviewer_notes, handoverCode, claimId);

      // Reject competing pending claims on the same item to prevent double claims
      const competing = db
        .prepare(`SELECT id, claimant_id FROM claims WHERE item_id = ? AND id != ? AND status = 'pending'`)
        .all(claim.item_id, claimId) as Array<{ id: number; claimant_id: number }>;

      for (const other of competing) {
        db.prepare(
          `UPDATE claims SET status = 'rejected', reviewer_id = ?, reviewer_notes = 'Another claimant verified ownership first.', updated_at = datetime('now') WHERE id = ?`
        ).run(req.user!.id, other.id);
        createNotification(
          other.claimant_id,
          `Claim update for ${claim.tracking_code}`,
          `Your verification request for "${claim.item_title}" was closed because another student verified ownership.`,
          'verification',
          claim.item_id
        );
      }

      db.prepare(`UPDATE items SET status = 'Claimed', updated_at = datetime('now') WHERE id = ?`).run(
        claim.item_id
      );

      createNotification(
        claim.claimant_id,
        `Ownership verified — Handover code ${handoverCode}`,
        `Your verification for "${claim.item_title}" (${claim.tracking_code}) was approved! Meet at ${claim.warden_desk} and confirm with code ${handoverCode}.`,
        'verification',
        claim.item_id
      );

      res.json({ ok: true, status: 'approved', handover_code: handoverCode });
      return;
    }

    // Rejected
    db.prepare(
      `UPDATE claims SET status = 'rejected', reviewer_id = ?, reviewer_notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(req.user!.id, reviewer_notes, claimId);

    const remainingPending = (
      db
        .prepare(`SELECT COUNT(*) as count FROM claims WHERE item_id = ? AND status = 'pending'`)
        .get(claim.item_id) as { count: number }
    ).count;

    if (remainingPending === 0) {
      const fallbackStatus = claim.item_type === 'lost' ? 'Lost' : 'Found';
      db.prepare(`UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
        fallbackStatus,
        claim.item_id
      );
    }

    createNotification(
      claim.claimant_id,
      `Verification declined for ${claim.tracking_code}`,
      `Your claim for "${claim.item_title}" was not approved${reviewer_notes ? `: ${reviewer_notes}` : '.'}`,
      'verification',
      claim.item_id
    );

    res.json({ ok: true, status: 'rejected' });
  });

  // Complete Handover -> Mark Returned & Award Points
  router.post('/claims/:id/complete', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const claimId = Number(req.params.id);
    const parsed = completeClaimSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    const claim = db
      .prepare(
        `SELECT c.*, i.reporter_id, i.tracking_code, i.title as item_title, i.type as item_type
         FROM claims c
         JOIN items i ON i.id = c.item_id
         WHERE c.id = ?`
      )
      .get(claimId) as any;

    if (!claim) {
      res.status(404).json({ error: 'Claim not found.' });
      return;
    }

    const isReporter = claim.reporter_id === req.user!.id;
    const isClaimant = claim.claimant_id === req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    if (!isReporter && !isClaimant && !isAdmin) {
      res.status(403).json({ error: 'You are not authorized to complete this handover.' });
      return;
    }

    if (claim.status !== 'approved') {
      res.status(400).json({ error: 'Only approved claims can be marked as returned.' });
      return;
    }

    if (!isAdmin) {
      const entered = parsed.data.handover_code.trim().toUpperCase();
      if (!entered || entered !== claim.handover_code.toUpperCase()) {
        res.status(400).json({ error: 'Handover confirmation code does not match. Check the 6-character code.' });
        return;
      }
    }

    db.prepare(`UPDATE claims SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(claimId);
    db.prepare(`UPDATE items SET status = 'Returned', updated_at = datetime('now') WHERE id = ?`).run(claim.item_id);

    // Reward the finder: if item was reported Found, reporter is finder; if item was reported Lost, claimant found it!
    const finderId = claim.item_type === 'found' ? claim.reporter_id : claim.claimant_id;
    awardPoints(
      finderId,
      claim.item_id,
      50,
      `Verified return of ${claim.item_title} (${claim.tracking_code})`,
      true
    );

    createNotification(
      claim.reporter_id,
      `Item returned: ${claim.tracking_code}`,
      `"${claim.item_title}" has been officially marked as Returned. Thank you for keeping our hostel community trustworthy!`,
      'return',
      claim.item_id
    );
    createNotification(
      claim.claimant_id,
      `Handover complete: ${claim.tracking_code}`,
      `Handover for "${claim.item_title}" is complete and recorded as Returned.`,
      'return',
      claim.item_id
    );

    res.json({ ok: true, status: 'Returned', points_awarded: 50 });
  });

  // Notifications
  router.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const notifications = db
      .prepare(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`
      )
      .all(req.user!.id);
    const unreadCount = (
      db
        .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
        .get(req.user!.id) as { count: number }
    ).count;

    res.json({ notifications, unread_count: unreadCount });
  });

  router.patch('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
    res.json({ ok: true });
  });

  router.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const notifId = Number(req.params.id);
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, req.user!.id);
    res.json({ ok: true });
  });

  // Leaderboard & Appreciation System
  router.get('/leaderboard', (_req, res: Response) => {
    const leaders = db
      .prepare(
        `SELECT u.id, u.full_name, u.points, u.returned_count, u.badge_tier,
                b.name as block_name, b.code as block_code
         FROM users u
         LEFT JOIN hostel_blocks b ON b.id = u.block_id
         WHERE u.role = 'student' AND u.is_active = 1
         ORDER BY u.points DESC, u.returned_count DESC, u.id ASC
         LIMIT 20`
      )
      .all();

    const recentAwards = db
      .prepare(
        `SELECT p.id, p.points, p.reason, p.created_at, u.full_name, b.name as block_name
         FROM point_logs p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN hostel_blocks b ON b.id = u.block_id
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 10`
      )
      .all();

    res.json({ leaders, recent_awards: recentAwards });
  });

  // Complaints / Disputes
  router.get('/complaints', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const isAdmin = req.user!.role === 'admin';
    const rows = isAdmin
      ? db
          .prepare(
            `SELECT c.*, u.full_name as user_name, u.student_id, i.tracking_code, i.title as item_title
             FROM complaints c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN items i ON i.id = c.item_id
             ORDER BY c.created_at DESC`
          )
          .all()
      : db
          .prepare(
            `SELECT c.*, u.full_name as user_name, u.student_id, i.tracking_code, i.title as item_title
             FROM complaints c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN items i ON i.id = c.item_id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`
          )
          .all(req.user!.id);

    res.json({ complaints: rows });
  });

  router.post('/complaints', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const parsed = createComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    const { item_id, subject, details } = parsed.data;
    if (item_id) {
      const exists = db.prepare('SELECT id FROM items WHERE id = ?').get(item_id);
      if (!exists) {
        res.status(400).json({ error: 'Referenced item does not exist.' });
        return;
      }
    }

    const result = db
      .prepare('INSERT INTO complaints (user_id, item_id, subject, details) VALUES (?, ?, ?, ?)')
      .run(req.user!.id, item_id || null, subject, details);

    // Notify admins
    const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as Array<{ id: number }>;
    for (const admin of admins) {
      createNotification(
        admin.id,
        'New student support / dispute ticket',
        `${req.user!.full_name} filed: "${subject}"`,
        'system',
        item_id || null
      );
    }

    const created = db.prepare('SELECT * FROM complaints WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ complaint: created });
  });

  // Admin Console Routes
  router.get('/admin/overview', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const itemStats = db
      .prepare(
        `SELECT COUNT(*) as total_items,
                SUM(CASE WHEN status = 'Lost' THEN 1 ELSE 0 END) as lost_count,
                SUM(CASE WHEN status = 'Found' THEN 1 ELSE 0 END) as found_count,
                SUM(CASE WHEN status = 'Verification Pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'Claimed' THEN 1 ELSE 0 END) as claimed_count,
                SUM(CASE WHEN status = 'Returned' THEN 1 ELSE 0 END) as returned_count,
                SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed_count
         FROM items`
      )
      .get();

    const userStats = db
      .prepare(
        `SELECT COUNT(*) as total_users,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users
         FROM users WHERE role = 'student'`
      )
      .get();

    const claimStats = db
      .prepare(
        `SELECT COUNT(*) as total_claims,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_claims
         FROM claims`
      )
      .get();

    const complaintStats = db
      .prepare(
        `SELECT COUNT(*) as total_complaints,
                SUM(CASE WHEN status IN ('open', 'investigating') THEN 1 ELSE 0 END) as open_complaints
         FROM complaints`
      )
      .get();

    res.json({ itemStats, userStats, claimStats, complaintStats });
  });

  router.get('/admin/users', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const users = db
      .prepare(
        `SELECT u.id, u.full_name, u.email, u.student_id, u.role, u.block_id,
                u.room_number, u.phone, u.points, u.returned_count, u.badge_tier,
                u.is_active, u.created_at, b.name as block_name
         FROM users u
         LEFT JOIN hostel_blocks b ON b.id = u.block_id
         ORDER BY u.role DESC, u.created_at DESC`
      )
      .all();
    res.json({ users });
  });

  router.patch('/admin/users/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const targetId = Number(req.params.id);
    const parsed = adminUpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    if (targetId === req.user!.id && parsed.data.is_active === false) {
      res.status(400).json({ error: 'You cannot suspend your own administrator account.' });
      return;
    }

    const user = db.prepare('SELECT id, is_active, role FROM users WHERE id = ?').get(targetId) as any;
    if (!user) {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }

    const nextActive = parsed.data.is_active !== undefined ? (parsed.data.is_active ? 1 : 0) : user.is_active;
    const nextRole = parsed.data.role ?? user.role;

    db.prepare('UPDATE users SET is_active = ?, role = ? WHERE id = ?').run(nextActive, nextRole, targetId);
    res.json({ ok: true });
  });

  router.patch('/admin/complaints/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const complaintId = Number(req.params.id);
    const parsed = adminUpdateComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: formatValidationError(parsed.error) });
      return;
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId) as any;
    if (!complaint) {
      res.status(404).json({ error: 'Complaint ticket not found.' });
      return;
    }

    db.prepare(
      `UPDATE complaints SET status = ?, admin_response = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(parsed.data.status, parsed.data.admin_response, complaintId);

    createNotification(
      complaint.user_id,
      `Support ticket updated (${parsed.data.status})`,
      `Warden update on "${complaint.subject}": ${parsed.data.admin_response || `Marked as ${parsed.data.status}.`}`,
      'system',
      complaint.item_id || null
    );

    res.json({ ok: true });
  });

  router.delete('/admin/items/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const itemId = Number(req.params.id);
    const item = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId);
    if (!item) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }
    db.prepare('DELETE FROM items WHERE id = ?').run(itemId);
    res.json({ ok: true });
  });

  return router;
}
