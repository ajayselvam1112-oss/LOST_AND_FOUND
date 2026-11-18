import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'dormfind.db');
const dataDir = path.dirname(dbPath);
export const uploadsDir = path.resolve(dataDir, 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function computeBadgeTier(points: number): string {
  if (points >= 200) return 'Golden Samaritan';
  if (points >= 120) return 'Honesty Star';
  if (points >= 50) return 'Block Guardian';
  return 'Campus Helper';
}

const CANONICAL_BLOCKS = [
  {
    code: 'BLK-A',
    name: 'Block A',
    wing: 'North Wing',
    warden_name: 'Prof. R. Verma',
    warden_desk: 'Block A Ground Lobby Desk (Room 101)',
    total_floors: 4,
    map_x: 130,
    map_y: 95,
    gps_lat: 13.0081,
    gps_lng: 80.2364,
    description: 'North residential wing with 24/7 central study lounge and ground lobby desk.',
  },
  {
    code: 'BLK-B',
    name: 'Block B',
    wing: 'East Wing',
    warden_name: 'Dr. S. Kulkarni',
    warden_desk: 'Block B Entrance Security Desk',
    total_floors: 5,
    map_x: 285,
    map_y: 95,
    gps_lat: 13.0081,
    gps_lng: 80.2378,
    description: 'East residence wing near the cycle stand, water coolers, and basketball court.',
  },
  {
    code: 'BLK-C',
    name: 'Block C',
    wing: 'Central Quad',
    warden_name: 'Prof. A. Nair',
    warden_desk: 'Block C Atrium Warden Office',
    total_floors: 4,
    map_x: 440,
    map_y: 95,
    gps_lat: 13.0074,
    gps_lng: 80.2391,
    description: 'Central hostel hub connected directly to the main student mess and mailroom.',
  },
  {
    code: 'BLK-D',
    name: 'Block D',
    wing: 'West Wing',
    warden_name: 'Dr. M. Deshmukh',
    warden_desk: 'Block D Reception Desk',
    total_floors: 5,
    map_x: 130,
    map_y: 300,
    gps_lat: 13.0063,
    gps_lng: 80.2364,
    description: 'West residence wing featuring indoor badminton court and quiet reading hall.',
  },
  {
    code: 'BLK-E',
    name: 'Block E',
    wing: 'South Courtyard',
    warden_name: 'Mr. K. Banerjee',
    warden_desk: 'Block E Reading Room Custodian Desk',
    total_floors: 4,
    map_x: 285,
    map_y: 300,
    gps_lat: 13.0061,
    gps_lng: 80.2378,
    description: 'South courtyard wing adjacent to the library walkway and practice room.',
  },
  {
    code: 'BLK-F',
    name: 'Block F',
    wing: 'Research Annex',
    warden_name: 'Dr. P. Iyer',
    warden_desk: 'Block F Main Custodian Desk',
    total_floors: 5,
    map_x: 440,
    map_y: 300,
    gps_lat: 13.0063,
    gps_lng: 80.2392,
    description: 'Senior & postgraduate hostel annex near the innovation lab and café lawn.',
  },
];

function ensureColumnExists(tableName: string, columnName: string, columnDef: string): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

function syncBlocksAndGpsMigration(): void {
  ensureColumnExists('hostel_blocks', 'gps_lat', 'REAL NOT NULL DEFAULT 13.0069');
  ensureColumnExists('hostel_blocks', 'gps_lng', 'REAL NOT NULL DEFAULT 80.2375');
  ensureColumnExists('items', 'gps_lat', 'REAL');
  ensureColumnExists('items', 'gps_lng', 'REAL');

  const existingBlocks = db.prepare('SELECT id, code FROM hostel_blocks').all() as Array<{
    id: number;
    code: string;
  }>;
  if (existingBlocks.length === 0) {
    return;
  }

  const updateBlockStmt = db.prepare(`
    UPDATE hostel_blocks
    SET name = ?, wing = ?, warden_name = ?, warden_desk = ?, total_floors = ?,
        map_x = ?, map_y = ?, gps_lat = ?, gps_lng = ?, description = ?
    WHERE code = ?
  `);

  const insertBlockStmt = db.prepare(`
    INSERT INTO hostel_blocks (code, name, wing, warden_name, warden_desk, total_floors, map_x, map_y, gps_lat, gps_lng, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const blk of CANONICAL_BLOCKS) {
    const found = existingBlocks.find((b) => b.code === blk.code);
    if (found) {
      updateBlockStmt.run(
        blk.name,
        blk.wing,
        blk.warden_name,
        blk.warden_desk,
        blk.total_floors,
        blk.map_x,
        blk.map_y,
        blk.gps_lat,
        blk.gps_lng,
        blk.description,
        blk.code
      );
    } else {
      insertBlockStmt.run(
        blk.code,
        blk.name,
        blk.wing,
        blk.warden_name,
        blk.warden_desk,
        blk.total_floors,
        blk.map_x,
        blk.map_y,
        blk.gps_lat,
        blk.gps_lng,
        blk.description
      );
    }
  }

  // Ensure existing items without GPS coordinates receive coordinates near their block
  const itemsWithoutGps = db
    .prepare(
      `SELECT i.id, b.gps_lat as b_lat, b.gps_lng as b_lng
       FROM items i
       JOIN hostel_blocks b ON b.id = i.block_id
       WHERE i.gps_lat IS NULL OR i.gps_lng IS NULL`
    )
    .all() as Array<{ id: number; b_lat: number; b_lng: number }>;

  const setItemGps = db.prepare('UPDATE items SET gps_lat = ?, gps_lng = ? WHERE id = ?');
  for (const row of itemsWithoutGps) {
    const offsetLat = ((row.id % 5) - 2) * 0.00014;
    const offsetLng = ((row.id % 3) - 1) * 0.00016;
    setItemGps.run(Number((row.b_lat + offsetLat).toFixed(6)), Number((row.b_lng + offsetLng).toFixed(6)), row.id);
  }

  // Ensure Block F sample item exists when upgrading an older DB
  const blockFRow = db.prepare("SELECT id FROM hostel_blocks WHERE code = 'BLK-F'").get() as
    | { id: number }
    | undefined;
  const df1009 = db.prepare("SELECT id FROM items WHERE tracking_code = 'DF-1009'").get();
  const anyReporter = db.prepare("SELECT id FROM users WHERE role = 'student' LIMIT 1").get() as
    | { id: number }
    | undefined;

  if (blockFRow && !df1009 && anyReporter) {
    db.prepare(
      `INSERT INTO items (
        tracking_code, type, title, category, description, secret_detail, image_url,
        block_id, floor, location_vicinity, gps_lat, gps_lng, incident_date, incident_time, status,
        reporter_id, finder_contact_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'DF-1009',
      'found',
      'Silver Metal Campus ID Card Holder',
      'ID & Keys',
      'Found a brushed metal ID lanyard clip near the Block F café lawn bench after evening seminar.',
      'Contains a faded robotics club sticker on the inner clip.',
      '',
      blockFRow.id,
      'Ground Floor',
      'Block F Café Lawn Bench',
      13.00642,
      80.23935,
      '2026-11-18',
      '08:20',
      'Found',
      anyReporter.id,
      'Deposited at Block F Main Custodian Desk.'
    );
  }
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hostel_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      wing TEXT NOT NULL,
      warden_name TEXT NOT NULL,
      warden_desk TEXT NOT NULL,
      total_floors INTEGER NOT NULL DEFAULT 4,
      map_x INTEGER NOT NULL,
      map_y INTEGER NOT NULL,
      gps_lat REAL NOT NULL DEFAULT 13.0069,
      gps_lng REAL NOT NULL DEFAULT 80.2375,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      student_id TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
      block_id INTEGER REFERENCES hostel_blocks(id) ON DELETE SET NULL,
      room_number TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      points INTEGER NOT NULL DEFAULT 0,
      returned_count INTEGER NOT NULL DEFAULT 0,
      badge_tier TEXT NOT NULL DEFAULT 'Campus Helper',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      secret_detail TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      block_id INTEGER NOT NULL REFERENCES hostel_blocks(id) ON DELETE RESTRICT,
      floor TEXT NOT NULL,
      location_vicinity TEXT NOT NULL,
      gps_lat REAL,
      gps_lng REAL,
      incident_date TEXT NOT NULL,
      incident_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Lost' CHECK (
        status IN ('Lost', 'Found', 'Verification Pending', 'Claimed', 'Returned', 'Closed')
      ),
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      finder_contact_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      claimant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      claim_type TEXT NOT NULL CHECK (claim_type IN ('claim_found_item', 'report_found_for_lost')),
      verification_answer TEXT NOT NULL,
      supporting_evidence_url TEXT NOT NULL DEFAULT '',
      supporting_notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'completed')
      ),
      reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewer_notes TEXT NOT NULL DEFAULT '',
      handover_code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('match', 'claim', 'verification', 'return', 'system')),
      related_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (
        status IN ('open', 'investigating', 'resolved', 'dismissed')
      ),
      admin_response TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS point_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_items_block_status ON items(block_id, status);
    CREATE INDEX IF NOT EXISTS idx_items_type_category ON items(type, category);
    CREATE INDEX IF NOT EXISTS idx_claims_item ON claims(item_id, status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  `);

  syncBlocksAndGpsMigration();

  const blockCount = (db.prepare('SELECT COUNT(*) as count FROM hostel_blocks').get() as { count: number }).count;
  if (blockCount === 0) {
    seedInitialData();
  }
}

function seedInitialData(): void {
  const insertBlock = db.prepare(`
    INSERT INTO hostel_blocks (code, name, wing, warden_name, warden_desk, total_floors, map_x, map_y, gps_lat, gps_lng, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of CANONICAL_BLOCKS) {
    insertBlock.run(
      b.code,
      b.name,
      b.wing,
      b.warden_name,
      b.warden_desk,
      b.total_floors,
      b.map_x,
      b.map_y,
      b.gps_lat,
      b.gps_lng,
      b.description
    );
  }

  const studentHash = bcrypt.hashSync('student123', 10);
  const adminHash = bcrypt.hashSync('admin123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, student_id, role, block_id, room_number, phone, points, returned_count, badge_tier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('Chief Warden Nair', 'warden@dormfind.edu', adminHash, 'ADM-001', 'admin', 3, 'Office-01', '+91-98000-00001', 0, 0, 'Warden Admin');
  insertUser.run('Aarav Sharma', 'aarav@dormfind.edu', studentHash, 'STU2026014', 'student', 1, 'A-204', '+91-98111-10204', 185, 3, computeBadgeTier(185));
  insertUser.run('Priya Menon', 'priya@dormfind.edu', studentHash, 'STU2026029', 'student', 4, 'D-312', '+91-98111-10312', 240, 4, computeBadgeTier(240));
  insertUser.run('Rohan Deshpande', 'rohan@dormfind.edu', studentHash, 'STU2026042', 'student', 2, 'B-118', '+91-98111-10118', 75, 1, computeBadgeTier(75));
  insertUser.run('Meera Krishnan', 'meera@dormfind.edu', studentHash, 'STU2026058', 'student', 5, 'E-105', '+91-98111-10105', 130, 2, computeBadgeTier(130));
  insertUser.run('Kabir Malhotra', 'kabir@dormfind.edu', studentHash, 'STU2026071', 'student', 6, 'F-402', '+91-98111-10402', 30, 0, computeBadgeTier(30));

  const insertItem = db.prepare(`
    INSERT INTO items (
      tracking_code, type, title, category, description, secret_detail, image_url,
      block_id, floor, location_vicinity, gps_lat, gps_lng, incident_date, incident_time, status,
      reporter_id, finder_contact_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertItem.run(
    'DF-1001',
    'found',
    'White Wireless Earbuds Charging Case',
    'Electronics',
    'Found a white wireless earbuds charging case plugged in near the north window study desk. Both earbuds appear to be inside.',
    'Has a faint blue ink mark near the USB-C charging port and Bluetooth name starts with Aarav.',
    '/src/assets/images/sample_earbuds_case_1795008980342.jpg',
    1,
    '2nd Floor',
    'North Window Study Lounge',
    13.00822,
    80.23655,
    '2026-11-17',
    '18:40',
    'Found',
    3,
    'Deposited safely at Block A Ground Lobby Desk after verification.'
  );

  insertItem.run(
    'DF-1002',
    'lost',
    'Brass Hostel Room Key on Blue Lanyard',
    'ID & Keys',
    'Lost my set of three keys attached to a woven royal blue lanyard with a white buckle near the stairwell water cooler.',
    'Brass key stamped 214 and silver padlock key engraved ABUS 106.',
    '/src/assets/images/sample_hostel_keys_1795008980618.jpg',
    2,
    '1st Floor',
    'Main Stairwell Water Cooler',
    13.00818,
    80.23794,
    '2026-11-17',
    '09:15',
    'Lost',
    4,
    'Please hand over to Block B Security Desk or submit a found report here.'
  );

  insertItem.run(
    'DF-1003',
    'found',
    'Brown Leather Bifold Wallet',
    'Wallet & Cards',
    'Picked up a worn brown leather bifold wallet left on the dining bench outside the Central Mess entrance during lunch.',
    'Contains a student library card ending in 449 and a folded metro ticket.',
    '/src/assets/images/sample_leather_wallet_1795008981036.jpg',
    3,
    'Ground Floor',
    'Central Mess Entrance Bench',
    13.00731,
    80.23892,
    '2026-11-16',
    '13:20',
    'Verification Pending',
    2,
    'Held securely at Block C Atrium Warden Office.'
  );

  insertItem.run(
    'DF-1004',
    'lost',
    'Casio fx-991EX Scientific Calculator',
    'Books & Notes',
    'Left my black scientific calculator in the reading hall after evening calculus prep. Urgent for upcoming midterms.',
    'Initials M.K. lightly etched on the back battery cover.',
    '/src/assets/images/sample_calculator_1795008981429.jpg',
    5,
    '1st Floor',
    'Block E Reading Hall Table 3',
    13.00598,
    80.23772,
    '2026-11-16',
    '21:10',
    'Lost',
    5,
    'Rewarding with heartfelt thanks and leaderboard karma!'
  );

  insertItem.run(
    'DF-1005',
    'found',
    'Matte Navy Insulated Water Flask',
    'Accessories',
    'Matte dark navy stainless steel water flask found sitting on the corridor parapet wall near the staircase.',
    'Small circular dent on the bottom base and subtle scratch near the cap hinge.',
    '/src/assets/images/sample_flask_bottle_1795008981637.jpg',
    4,
    '3rd Floor',
    'East Staircase Corridor Ledge',
    13.00642,
    80.23628,
    '2026-11-15',
    '16:05',
    'Claimed',
    3,
    'Owner verified; ready for handover at Block D Reception Desk.'
  );

  insertItem.run(
    'DF-1006',
    'found',
    '65W USB-C Laptop Power Adapter',
    'Electronics',
    'Found a black 65W USB-C laptop charger left plugged into the wall socket behind the common room sofa.',
    'Wrapped neatly with a bright green velcro cable strap.',
    '',
    1,
    'Ground Floor',
    'Common Room TV Corner',
    13.00798,
    80.23632,
    '2026-11-13',
    '22:30',
    'Returned',
    2,
    'Returned to verified owner in Block A.'
  );

  insertItem.run(
    'DF-1007',
    'lost',
    'Rimless Reading Glasses in Grey Case',
    'Accessories',
    'Misplaced my rectangular rimless glasses inside a hard grey clamshell case near the indoor badminton court bench.',
    'Blue-light tint lenses with a light blue microfiber cloth inside.',
    '',
    4,
    'Ground Floor',
    'Badminton Court Spectator Bench',
    13.00622,
    80.23656,
    '2026-11-17',
    '19:50',
    'Lost',
    6,
    'Reach out via DormFind verification if spotted.'
  );

  insertItem.run(
    'DF-1008',
    'found',
    'Foldable Grey Umbrella with Wood Handle',
    'Other',
    'Found near the cycle shed after last week’s rain. Unclaimed for 30 days and archived at Warden Office.',
    'Curved light oak handle with black wrist loop.',
    '',
    2,
    'Ground Floor',
    'East Cycle Stand Shed',
    13.00802,
    80.23768,
    '2026-10-12',
    '08:45',
    'Closed',
    4,
    'Archived at Block B Warden Desk.'
  );

  insertItem.run(
    'DF-1009',
    'found',
    'Silver Metal Campus ID Card Holder',
    'ID & Keys',
    'Found a brushed metal ID lanyard clip near the Block F café lawn bench after evening seminar.',
    'Contains a faded robotics club sticker on the inner clip.',
    '',
    6,
    'Ground Floor',
    'Block F Café Lawn Bench',
    13.00642,
    80.23935,
    '2026-11-18',
    '08:20',
    'Found',
    6,
    'Deposited at Block F Main Custodian Desk.'
  );

  const insertClaim = db.prepare(`
    INSERT INTO claims (
      item_id, claimant_id, claim_type, verification_answer, supporting_notes,
      status, reviewer_id, reviewer_notes, handover_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertClaim.run(
    3,
    6,
    'claim_found_item',
    'My student library card inside ends in 449 and there is an old metro slip folded behind the ID slot.',
    'Can show my hostel ID card in person at the Atrium office.',
    'pending',
    null,
    '',
    ''
  );

  insertClaim.run(
    5,
    5,
    'claim_found_item',
    'It is a 750ml matte navy flask with a small circular dent on the bottom rim from dropping it near the library.',
    'Matches purchase receipt from campus store.',
    'approved',
    3,
    'Description matches the dent on the base accurately. Meet at Block D Reception Desk.',
    'DF8429'
  );

  insertClaim.run(
    6,
    6,
    'claim_found_item',
    'Lenovo 65W Type-C adapter tied with a green velcro strap.',
    'Verified serial number on handover.',
    'completed',
    2,
    'Handed over after code verification.',
    'DF1904'
  );

  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, title, message, category, related_item_id, is_read)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run(
    2,
    'New ownership claim received',
    'Kabir Malhotra submitted verification details for Brown Leather Bifold Wallet (DF-1003). Review their answer before approving.',
    'claim',
    3,
    0
  );
  insertNotif.run(
    5,
    'Claim approved — handover code ready',
    'Your claim for Matte Navy Insulated Water Flask (DF-1005) was approved. Use handover code DF8429 at Block D Reception Desk.',
    'verification',
    5,
    0
  );
  insertNotif.run(
    6,
    'Return completed successfully',
    '65W USB-C Laptop Power Adapter (DF-1006) has been marked Returned. Thank you for verifying promptly.',
    'return',
    6,
    1
  );
  insertNotif.run(
    4,
    'Safety reminder for lost keys',
    'Your lost report DF-1002 is visible to Block B residents. Check Block B Security Desk for physical drop-offs.',
    'system',
    2,
    0
  );

  const insertComplaint = db.prepare(`
    INSERT INTO complaints (user_id, item_id, subject, details, status, admin_response)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertComplaint.run(
    6,
    3,
    'Requesting warden verification window for Wallet DF-1003',
    'I submitted my verification proof for DF-1003 and need to collect my library card before tomorrow morning lab.',
    'investigating',
    'Block C Atrium Warden Office has flagged DF-1003 for priority review today between 5:00 PM and 7:00 PM.'
  );

  const insertPointLog = db.prepare(`
    INSERT INTO point_logs (user_id, item_id, points, reason)
    VALUES (?, ?, ?, ?)
  `);

  insertPointLog.run(3, 1, 10, 'Registered found item DF-1001');
  insertPointLog.run(2, 6, 50, 'Verified return of 65W USB-C Laptop Power Adapter (DF-1006)');
  insertPointLog.run(4, 8, 10, 'Registered found item DF-1008');
}
