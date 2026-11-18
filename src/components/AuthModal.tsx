import { Loader2, Lock, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, setStoredToken } from '../lib/api';
import type { HostelBlock, User } from '../types';

const FALLBACK_BLOCKS: Array<{ id: number; name: string }> = [
  { id: 1, name: 'Block A' },
  { id: 2, name: 'Block B' },
  { id: 3, name: 'Block C' },
  { id: 4, name: 'Block D' },
  { id: 5, name: 'Block E' },
  { id: 6, name: 'Block F' },
];

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  blocks: HostelBlock[];
  onClose: () => void;
  onAuthenticated: (user: User, mode: 'login' | 'register') => void;
  onBlocksLoaded?: (blocks: HostelBlock[]) => void;
}

export function AuthModal({
  isOpen,
  initialMode = 'login',
  blocks,
  onClose,
  onAuthenticated,
  onBlocksLoaded,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [error, setError] = useState('');

  const [localBlocks, setLocalBlocks] = useState<HostelBlock[]>(blocks);
  const availableBlocks: Array<{ id: number; name: string }> =
    localBlocks.length > 0 ? localBlocks : FALLBACK_BLOCKS;

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [blockId, setBlockId] = useState<string>(
    availableBlocks[0] ? String(availableBlocks[0].id) : '1'
  );
  const [roomNumber, setRoomNumber] = useState('');
  const [phone, setPhone] = useState('');

  // Sync mode and clear stale errors whenever modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
    }
  }, [isOpen, initialMode]);

  // Keep localBlocks synced with parent blocks prop
  useEffect(() => {
    if (blocks.length > 0) {
      setLocalBlocks(blocks);
    }
  }, [blocks]);

  // Fetch blocks automatically when modal opens if parent didn't have them yet
  useEffect(() => {
    if (!isOpen || blocks.length > 0) return;

    let cancelled = false;
    async function fetchBlocks() {
      setBlocksLoading(true);
      try {
        const res = await apiRequest<{ blocks: HostelBlock[] }>('/api/blocks');
        if (!cancelled && res.blocks && res.blocks.length > 0) {
          setLocalBlocks(res.blocks);
          onBlocksLoaded?.(res.blocks);
        }
      } catch {
        // Keep FALLBACK_BLOCKS so select remains usable even during transient network hiccups
      } finally {
        if (!cancelled) {
          setBlocksLoading(false);
        }
      }
    }
    fetchBlocks();

    return () => {
      cancelled = true;
    };
  }, [isOpen, blocks.length, onBlocksLoaded]);

  // Ensure selected blockId always matches a valid option in availableBlocks
  useEffect(() => {
    if (availableBlocks.length === 0) return;
    const isValidSelection = availableBlocks.some((b) => String(b.id) === blockId);
    if (!isValidSelection) {
      setBlockId(String(availableBlocks[0].id));
    }
  }, [availableBlocks, blockId]);

  if (!isOpen) return null;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setStoredToken(data.token);
      onAuthenticated(data.user, 'login');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid student email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (studentId.trim().length < 4) {
      setError('Student ID must be at least 4 characters (e.g. STU2026099).');
      return;
    }
    const parsedBlockId = Number(blockId);
    if (!Number.isInteger(parsedBlockId) || parsedBlockId <= 0) {
      setError('Please select your hostel block.');
      return;
    }
    if (!roomNumber.trim()) {
      setError('Please enter your hostel room number.');
      return;
    }
    if (phone.trim().length < 7) {
      setError('Please enter a valid contact phone number (at least 7 digits).');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          student_id: studentId.trim(),
          block_id: parsedBlockId,
          room_number: roomNumber.trim(),
          phone: phone.trim(),
        }),
      });
      setStoredToken(data.token);
      onAuthenticated(data.user, 'register');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithDemo(demoEmail: string, demoPassword: string) {
    setError('');
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });
      setStoredToken(data.token);
      onAuthenticated(data.user, 'login');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="my-auto w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900">
              {mode === 'login' ? 'Sign in to DormFind' : 'Student Registration'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified campus access keeps belongings and student details safe.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="register-full-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="register-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ananya Iyer"
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="register-student-id" className="block text-xs font-semibold text-slate-700 mb-1">
                    Student ID
                  </label>
                  <input
                    id="register-student-id"
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="STU2026099"
                    className="w-full px-3 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="register-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone (Private)
                  </label>
                  <input
                    id="register-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91-98xxx-xxxxx"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="register-hostel-block" className="block text-xs font-semibold text-slate-700 mb-1">
                    Hostel Block
                  </label>
                  <select
                    id="register-hostel-block"
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                    disabled={blocksLoading}
                    className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {availableBlocks.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="register-room-number" className="block text-xs font-semibold text-slate-700 mb-1">
                    Room No. (Private)
                  </label>
                  <input
                    id="register-room-number"
                    type="text"
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. A-210"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Campus Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@dormfind.edu"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode === 'register' ? 6 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter your password'}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>{mode === 'login' ? 'Sign In' : 'Create Student Account'}</span>
          </button>

          {mode === 'login' && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-[11px] font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Quick Demo Sign-In (for testing workflows)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => loginWithDemo('aarav@dormfind.edu', 'student123')}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-left"
                >
                  <div className="font-semibold text-slate-900">Student Demo</div>
                  <div className="text-[11px] text-slate-500 truncate">Aarav Sharma</div>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => loginWithDemo('warden@dormfind.edu', 'admin123')}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-left"
                >
                  <div className="font-semibold text-slate-900">Warden Admin</div>
                  <div className="text-[11px] text-slate-500 truncate">Chief Warden Nair</div>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
