export type ItemType = 'lost' | 'found';

export type ItemCategory =
  | 'Electronics'
  | 'ID & Keys'
  | 'Wallet & Cards'
  | 'Books & Notes'
  | 'Clothing'
  | 'Accessories'
  | 'Sports & Gear'
  | 'Other';

export type ItemStatus =
  | 'Lost'
  | 'Found'
  | 'Verification Pending'
  | 'Claimed'
  | 'Returned'
  | 'Closed';

export const ITEM_CATEGORIES: ItemCategory[] = [
  'Electronics',
  'ID & Keys',
  'Wallet & Cards',
  'Books & Notes',
  'Clothing',
  'Accessories',
  'Sports & Gear',
  'Other',
];

export const ITEM_STATUSES: ItemStatus[] = [
  'Lost',
  'Found',
  'Verification Pending',
  'Claimed',
  'Returned',
  'Closed',
];

export interface User {
  id: number;
  full_name: string;
  email: string;
  student_id: string;
  role: 'student' | 'admin';
  block_id: number | null;
  block_name: string;
  block_code: string;
  room_number: string;
  phone: string;
  points: number;
  returned_count: number;
  badge_tier: string;
}

export interface HostelBlock {
  id: number;
  code: string;
  name: string;
  wing: string;
  warden_name: string;
  warden_desk: string;
  total_floors: number;
  map_x: number;
  map_y: number;
  gps_lat: number;
  gps_lng: number;
  description: string;
  lost_count: number;
  found_count: number;
  returned_count: number;
  total_items: number;
}

export interface ItemRecord {
  id: number;
  tracking_code: string;
  type: ItemType;
  title: string;
  category: ItemCategory;
  description: string;
  secret_detail?: string;
  has_secret_detail?: boolean;
  image_url: string;
  block_id: number;
  block_name: string;
  block_code: string;
  warden_name?: string;
  warden_desk?: string;
  floor: string;
  location_vicinity: string;
  gps_lat: number | null;
  gps_lng: number | null;
  incident_date: string;
  incident_time: string;
  status: ItemStatus;
  reporter_id: number;
  reporter_name: string;
  reporter_badge: string;
  reporter_block_name?: string;
  finder_contact_note: string;
  pending_claims_count?: number;
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClaimRecord {
  id: number;
  item_id: number;
  claimant_id: number;
  claim_type: 'claim_found_item' | 'report_found_for_lost';
  verification_answer: string;
  supporting_evidence_url: string;
  supporting_notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reviewer_id: number | null;
  reviewer_notes: string;
  handover_code: string;
  created_at: string;
  updated_at: string;
  tracking_code?: string;
  item_title?: string;
  item_type?: ItemType;
  item_status?: ItemStatus;
  secret_detail?: string;
  item_image_url?: string;
  reporter_id?: number;
  block_name?: string;
  warden_desk?: string;
  claimant_name?: string;
  claimant_student_id?: string;
  claimant_badge?: string;
  claimant_block_name?: string;
  reporter_name?: string;
}

export interface NotificationRecord {
  id: number;
  user_id: number;
  title: string;
  message: string;
  category: 'match' | 'claim' | 'verification' | 'return' | 'system';
  related_item_id: number | null;
  is_read: number;
  created_at: string;
}

export interface ComplaintRecord {
  id: number;
  user_id: number;
  item_id: number | null;
  subject: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  admin_response: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  student_id?: string;
  tracking_code?: string;
  item_title?: string;
}

export interface LeaderboardEntry {
  id: number;
  full_name: string;
  points: number;
  returned_count: number;
  badge_tier: string;
  block_name: string;
  block_code: string;
}

export interface PointAwardLog {
  id: number;
  points: number;
  reason: string;
  created_at: string;
  full_name: string;
  block_name: string;
}

export interface AdminOverview {
  itemStats: {
    total_items: number;
    lost_count: number;
    found_count: number;
    pending_count: number;
    claimed_count: number;
    returned_count: number;
    closed_count: number;
  };
  userStats: {
    total_users: number;
    active_users: number;
  };
  claimStats: {
    total_claims: number;
    pending_claims: number;
  };
  complaintStats: {
    total_complaints: number;
    open_complaints: number;
  };
}

export interface AdminUserRecord {
  id: number;
  full_name: string;
  email: string;
  student_id: string;
  role: 'student' | 'admin';
  block_id: number | null;
  block_name: string | null;
  room_number: string;
  phone: string;
  points: number;
  returned_count: number;
  badge_tier: string;
  is_active: number;
  created_at: string;
}
