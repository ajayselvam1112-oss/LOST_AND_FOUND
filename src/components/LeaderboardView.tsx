import { Award, Medal, Shield, Star, Trophy } from 'lucide-react';
import type { LeaderboardEntry, PointAwardLog, User } from '../types';

interface LeaderboardViewProps {
  leaders: LeaderboardEntry[];
  recentAwards: PointAwardLog[];
  currentUser: User | null;
}

const BADGE_TIERS = [
  {
    name: 'Campus Helper',
    threshold: '0 – 49 pts',
    description: 'Earned when registering your first found item on DormFind.',
    icon: Shield,
  },
  {
    name: 'Block Guardian',
    threshold: '50 – 119 pts',
    description: 'Awarded after completing your first verified item return.',
    icon: Medal,
  },
  {
    name: 'Honesty Star',
    threshold: '120 – 199 pts',
    description: 'Recognizes multiple verified returns across hostel wings.',
    icon: Star,
  },
  {
    name: 'Golden Samaritan',
    threshold: '200+ pts',
    description: 'Highest hostel honor for consistently safeguarding student belongings.',
    icon: Trophy,
  },
];

export function LeaderboardView({ leaders, recentAwards, currentUser }: LeaderboardViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Student Appreciation &amp; Leaderboard
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Students earn +10 points for registering a found item and +50 points upon verified return to its owner.
        </p>
      </div>

      {/* Badge Progression Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BADGE_TIERS.map((tier) => {
          const Icon = tier.icon;
          const isCurrent = currentUser?.badge_tier === tier.name;
          return (
            <div
              key={tier.name}
              className={`bg-white border rounded-xl p-4 space-y-2 ${
                isCurrent ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`} />
                <span className="text-xs font-mono tabular-nums text-slate-500">{tier.threshold}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {tier.name} {isCurrent && '(Your Tier)'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">{tier.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Contributors Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Hostel Honesty Leaderboard</h2>
            <span className="text-xs text-slate-500">Ranked by verification points</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Rank</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Hostel Block</th>
                  <th className="py-2.5 px-4">Badge</th>
                  <th className="py-2.5 px-4 text-right">Returns</th>
                  <th className="py-2.5 px-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {leaders.map((entry, idx) => {
                  const isMe = currentUser?.id === entry.id;
                  return (
                    <tr key={entry.id} className={isMe ? 'bg-blue-50/70' : 'hover:bg-slate-50'}>
                      <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-700">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {entry.full_name} {isMe && '(You)'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{entry.block_name}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{entry.badge_tier}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {entry.returned_count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-blue-700">
                        {entry.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Recognition Feed */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-bold text-slate-900">Recent Point Awards</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAwards.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No appreciation logs recorded yet.</p>
            ) : (
              recentAwards.map((log) => (
                <div key={log.id} className="p-4 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{log.full_name}</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-700">
                      +{log.points} pts
                    </span>
                  </div>
                  <p className="text-slate-600">{log.reason}</p>
                  <p className="text-[11px] text-slate-400">
                    {log.block_name} · {log.created_at.slice(0, 10)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
