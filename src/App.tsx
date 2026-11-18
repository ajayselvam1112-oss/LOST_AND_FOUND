import {
  Award,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { CampusMapView } from './components/CampusMapView';
import { ClaimsView } from './components/ClaimsView';
import { ComplaintsModal } from './components/ComplaintsModal';
import { ItemCard } from './components/ItemCard';
import { ItemDetailModal } from './components/ItemDetailModal';
import { LeaderboardView } from './components/LeaderboardView';
import { NotificationsView } from './components/NotificationsView';
import { ReportItemModal } from './components/ReportItemModal';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api';
import {
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  type ClaimRecord,
  type ComplaintRecord,
  type HostelBlock,
  type ItemRecord,
  type ItemType,
  type LeaderboardEntry,
  type NotificationRecord,
  type PointAwardLog,
  type User,
} from './types';

type ActiveSection =
  | 'overview'
  | 'browse'
  | 'blocks'
  | 'claims'
  | 'leaderboard'
  | 'notifications'
  | 'admin';

export default function App() {
  const [section, setSection] = useState<ActiveSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Core data
  const [blocks, setBlocks] = useState<HostelBlock[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState('');
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [recentAwards, setRecentAwards] = useState<PointAwardLog[]>([]);

  // Filters for Browse Items
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found' | 'mine'>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [blockFilter, setBlockFilter] = useState<string>('0');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');

  // Selected block on map
  const [selectedMapBlockId, setSelectedMapBlockId] = useState<number | null>(null);

  // Modals
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportDefaultType, setReportDefaultType] = useState<ItemType>('lost');
  const [reportDefaultBlockId, setReportDefaultBlockId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintItem, setComplaintItem] = useState<ItemRecord | null>(null);

  // Toast confirmation banner & Google Maps quota state
  const [toast, setToast] = useState<string>('');
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => {
      setToast((current) => (current === msg ? '' : current));
    }, 4500);
  }

  const loadBlocks = useCallback(async () => {
    try {
      const res = await apiRequest<{ blocks: HostelBlock[] }>('/api/blocks');
      setBlocks(res.blocks);
      if (res.blocks.length > 0 && selectedMapBlockId === null) {
        setSelectedMapBlockId(res.blocks[0].id);
      }
    } catch {
      // Keep graceful UI
    }
  }, [selectedMapBlockId]);

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (typeFilter === 'lost' || typeFilter === 'found') params.set('type', typeFilter);
      if (typeFilter === 'mine') params.set('mine', 'true');
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      if (blockFilter !== '0') params.set('block_id', blockFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);

      const res = await apiRequest<{ items: ItemRecord[] }>(`/api/items?${params.toString()}`);
      setItems(res.items);
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'Unable to load items.');
    } finally {
      setItemsLoading(false);
    }
  }, [searchQuery, typeFilter, categoryFilter, blockFilter, statusFilter, dateFrom]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await apiRequest<{ leaders: LeaderboardEntry[]; recent_awards: PointAwardLog[] }>(
        '/api/leaderboard'
      );
      setLeaders(res.leaders);
      setRecentAwards(res.recent_awards);
    } catch {
      // ignore
    }
  }, []);

  const loadUserWorkspace = useCallback(async (user: User | null) => {
    if (!user) {
      setClaims([]);
      setNotifications([]);
      setUnreadCount(0);
      setComplaints([]);
      return;
    }
    setClaimsLoading(true);
    try {
      const [clRes, nRes, cmpRes] = await Promise.all([
        apiRequest<{ claims: ClaimRecord[] }>('/api/claims'),
        apiRequest<{ notifications: NotificationRecord[]; unread_count: number }>('/api/notifications'),
        apiRequest<{ complaints: ComplaintRecord[] }>('/api/complaints'),
      ]);
      setClaims(clRes.claims);
      setNotifications(nRes.notifications);
      setUnreadCount(nRes.unread_count);
      setComplaints(cmpRes.complaints);
    } catch {
      // ignore
    } finally {
      setClaimsLoading(false);
    }
  }, []);

  // Bootstrap session on mount
  useEffect(() => {
    async function init() {
      await Promise.all([loadBlocks(), loadLeaderboard()]);
      const token = getStoredToken();
      if (token) {
        try {
          const me = await apiRequest<{ user: User }>('/api/auth/me');
          setCurrentUser(me.user);
          await loadUserWorkspace(me.user);
        } catch {
          setStoredToken(null);
          setCurrentUser(null);
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function refreshAll() {
    await Promise.all([loadBlocks(), loadItems(), loadLeaderboard()]);
    if (currentUser) {
      try {
        const me = await apiRequest<{ user: User }>('/api/auth/me');
        setCurrentUser(me.user);
        await loadUserWorkspace(me.user);
      } catch {
        // ignore
      }
    }
  }

  function openReportModal(defaultType: ItemType, blockId?: number | null) {
    if (!currentUser) {
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }
    setReportDefaultType(defaultType);
    setReportDefaultBlockId(blockId ?? currentUser.block_id ?? null);
    setReportModalOpen(true);
  }

  async function handleLogout() {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredToken(null);
    setCurrentUser(null);
    setClaims([]);
    setNotifications([]);
    setUnreadCount(0);
    setComplaints([]);
    if (section === 'admin') setSection('overview');
    if (typeFilter === 'mine') setTypeFilter('all');
    showToast('Signed out safely.');
  }

  function resetFilters() {
    setSearchQuery('');
    setTypeFilter('all');
    setCategoryFilter('All');
    setBlockFilter('0');
    setStatusFilter('All');
    setDateFrom('');
  }

  // Computed metrics for Overview
  const lostCount = blocks.reduce((sum, b) => sum + (b.lost_count || 0), 0);
  const foundCount = blocks.reduce((sum, b) => sum + (b.found_count || 0), 0);
  const returnedCount = blocks.reduce((sum, b) => sum + (b.returned_count || 0), 0);
  const pendingVerifications = items.filter((i) => i.status === 'Verification Pending').length;

  const navLinks: Array<{ id: ActiveSection; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'browse', label: 'Browse Items' },
    { id: 'blocks', label: 'Hostel Blocks' },
    { id: 'claims', label: 'Claims' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle workspace menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setSection('overview')}
              className="font-display text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              DormFind
            </button>
          </div>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setSection(link.id)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  section === link.id
                    ? 'text-slate-900 font-semibold border-blue-700'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={() => openReportModal('lost')}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Report Item</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Google Maps Demo Quota Warning Banner */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Toast Notification Bar */}
      {toast && (
        <div className="bg-slate-900 text-white text-xs font-medium px-4 py-2.5 text-center">
          {toast}
        </div>
      )}

      {/* Workspace Shell: 256px Sidebar + Main Content Viewport */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto flex">
        {/* Desktop Sidebar + Mobile Drawer */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl flex' : 'hidden'
          } lg:static lg:flex lg:w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4`}
        >
          <div className="space-y-6">
            {mobileMenuOpen && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 lg:hidden">
                <span className="font-display font-bold text-slate-900">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-500 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Account Summary */}
            {currentUser ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-sm font-bold text-slate-900 truncate">{currentUser.full_name}</div>
                <div className="text-xs text-slate-600 truncate">
                  {currentUser.student_id} · {currentUser.block_name}
                </div>
                <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-200">
                  <span className="font-medium text-blue-700">{currentUser.badge_tier}</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {currentUser.points} pts
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sign in with your campus account to report belongings, submit verification proof, or earn return badges.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg"
                  >
                    Register
                  </button>
                </div>
              </div>
            )}

            {/* Workspace Navigation */}
            <div className="space-y-1">
              {[
                { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
                { id: 'browse' as const, label: 'Browse Items', icon: PackageSearch },
                { id: 'blocks' as const, label: 'Hostel Blocks & Map', icon: Building2 },
                { id: 'claims' as const, label: 'Claims & Verification', icon: ClipboardCheck },
                {
                  id: 'notifications' as const,
                  label: unreadCount > 0 ? `Alerts & Support (${unreadCount})` : 'Alerts & Support',
                  icon: Bell,
                },
                { id: 'leaderboard' as const, label: 'Appreciation Board', icon: Award },
              ].map((nav) => {
                const Icon = nav.icon;
                const active = section === nav.id;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => {
                      setSection(nav.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{nav.label}</span>
                  </button>
                );
              })}

              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setSection('admin');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    section === 'admin'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Warden Admin Console</span>
                </button>
              )}
            </div>
          </div>

          {currentUser && (
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {section === 'overview' && (
            <div className="space-y-8">
              {/* Hero Welcome Band */}
              <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-2xl space-y-3">
                  <p className="text-xs font-semibold text-blue-700">
                    Centralized Hostel Lost &amp; Found Registry
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
                    Recover lost belongings safely across every hostel block.
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Report missing items, register belongings you found, verify rightful owners with
                    private clue checks, and coordinate handovers at official Warden Desks.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => openReportModal('lost')}
                    className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    Report Lost Item
                  </button>
                  <button
                    type="button"
                    onClick={() => openReportModal('found')}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    Register Found Item
                  </button>
                </div>
              </section>

              {/* 4-Column Live KPI Strip */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-medium text-slate-500">Active Lost Reports</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
                    {lostCount}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Across {blocks.length} hostel blocks</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-medium text-slate-500">Found &amp; Awaiting Owner</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-sky-700 mt-1">
                    {foundCount}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Held safely at desks/finders</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-medium text-slate-500">Verification Pending</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                    {pendingVerifications}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Under ownership review</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-medium text-slate-500">Successfully Returned</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    {returnedCount}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Verified code handovers</span>
                </div>
              </section>

              {/* Recent Reports Grid */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Recent Hostel Reports</h2>
                    <p className="text-xs text-slate-500">
                      Click any item to inspect vicinity details or start ownership verification.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSection('browse')}
                    className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
                  >
                    View all items
                  </button>
                </div>

                {itemsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.slice(0, 6).map((item) => (
                      <ItemCard key={item.id} item={item} onSelect={(id) => setSelectedItemId(id)} />
                    ))}
                  </div>
                )}
              </section>

              {/* 3-Step Verification Trust Row */}
              <section className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-4">
                  How DormFind Protects Ownership &amp; Student Privacy
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-900">01. Block &amp; Vicinity Only</div>
                    <p className="text-slate-600 leading-relaxed">
                      Reports record only the hostel block, floor, and public landmark. Room numbers and
                      personal phone numbers stay hidden.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-900">02. Hidden Proof Matching</div>
                    <p className="text-slate-600 leading-relaxed">
                      Finders record a secret identifying detail. Claimants must describe unique marks or
                      upload proof before approval.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-900">03. Handover Code &amp; Recognition</div>
                    <p className="text-slate-600 leading-relaxed">
                      Approved claims generate a 6-character code confirmed at the Warden Desk, awarding
                      +50 appreciation points upon return.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {section === 'browse' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Browse Lost &amp; Found Directory
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Filter by hostel block, item category, date, or verification status.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openReportModal('lost')}
                    className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                  >
                    + Report Lost
                  </button>
                  <button
                    type="button"
                    onClick={() => openReportModal('found')}
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap"
                  >
                    + Register Found
                  </button>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search item name, description, tracking code (e.g. DF-1001), or vicinity..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    {[
                      { id: 'all' as const, label: 'All' },
                      { id: 'lost' as const, label: 'Lost' },
                      { id: 'found' as const, label: 'Found' },
                      ...(currentUser ? [{ id: 'mine' as const, label: 'My Reports' }] : []),
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTypeFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          typeFilter === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <select
                    aria-label="Filter by category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="All">All Categories</option>
                    {ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by hostel block"
                    value={blockFilter}
                    onChange={(e) => setBlockFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="0">All Hostel Blocks</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="All">All Statuses</option>
                    {ITEM_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      aria-label="Filter from date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={resetFilters}
                      title="Reset filters"
                      className="px-2.5 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {itemsError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {itemsError}
                </div>
              )}

              {itemsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900">No items match your filters</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Try clearing one of your search filters or publish a new lost/found report for your block.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold rounded-lg"
                    >
                      Clear Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => openReportModal('lost')}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                    >
                      Report Missing Item
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} onSelect={(id) => setSelectedItemId(id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'blocks' && (
            <CampusMapView
              blocks={blocks}
              items={items}
              selectedBlockId={selectedMapBlockId}
              onSelectBlock={(id) => setSelectedMapBlockId(id)}
              onBrowseBlockItems={(blockId) => {
                setBlockFilter(String(blockId));
                setTypeFilter('all');
                setSection('browse');
              }}
              onReportInBlock={(blockId) => openReportModal('found', blockId)}
              onOpenItem={(id) => setSelectedItemId(id)}
            />
          )}

          {section === 'claims' && (
            <ClaimsView
              claims={claims}
              loading={claimsLoading}
              currentUser={currentUser}
              onRefresh={refreshAll}
              onOpenItem={(id) => setSelectedItemId(id)}
              onRequireAuth={() => {
                setAuthMode('login');
                setAuthModalOpen(true);
              }}
            />
          )}

          {section === 'leaderboard' && (
            <LeaderboardView leaders={leaders} recentAwards={recentAwards} currentUser={currentUser} />
          )}

          {section === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              complaints={complaints}
              currentUser={currentUser}
              onRefresh={refreshAll}
              onOpenItem={(id) => setSelectedItemId(id)}
              onOpenNewComplaint={() => {
                setComplaintItem(null);
                setComplaintModalOpen(true);
              }}
              onRequireAuth={() => {
                setAuthMode('login');
                setAuthModalOpen(true);
              }}
            />
          )}

          {section === 'admin' && currentUser?.role === 'admin' && (
            <AdminDashboard
              items={items}
              onRefreshItems={refreshAll}
              onOpenItem={(id) => setSelectedItemId(id)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        blocks={blocks}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          loadUserWorkspace(user);
          showToast(`Welcome back, ${user.full_name}.`);
        }}
      />

      <ReportItemModal
        isOpen={reportModalOpen}
        defaultType={reportDefaultType}
        blocks={blocks}
        defaultBlockId={reportDefaultBlockId}
        onClose={() => setReportModalOpen(false)}
        onCreated={(created) => {
          refreshAll();
          showToast(
            `${created.tracking_code} published!${
              created.type === 'found' ? ' +10 appreciation points awarded.' : ''
            }`
          );
          setSection('browse');
        }}
      />

      <ItemDetailModal
        itemId={selectedItemId}
        currentUser={currentUser}
        onClose={() => setSelectedItemId(null)}
        onRequireAuth={() => {
          setSelectedItemId(null);
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
        onRefresh={refreshAll}
        onOpenComplaint={(item) => {
          setSelectedItemId(null);
          setComplaintItem(item);
          setComplaintModalOpen(true);
        }}
      />

      <ComplaintsModal
        isOpen={complaintModalOpen}
        relatedItem={complaintItem}
        onClose={() => setComplaintModalOpen(false)}
        onSubmitted={() => {
          refreshAll();
          showToast('Support ticket sent to Hostel Warden.');
          setSection('notifications');
        }}
      />
    </div>
  );
}
