function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

export function fmt(v: number) {
  return v >= 1_000_000 ? `฿${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `฿${Math.round(v / 1_000)}K`
    : `฿${v}`;
}

export function calcPct(cur: number, prev: number) { return pct(cur, prev); }

// ── Theme tokens ────────────────────────────────────────────────
export const T = {
  teal:   '#2B8080',
  tealLt: '#3D9595',
  orange: '#D4745A',
  orangeLt: '#E08E78',
  sage:   '#5FAD82',
  gold:   '#D4A853',
  pink:   '#D46B8A',
  red:    '#D44A4A',
};

export const CHART_COLORS = [T.teal, T.orange, T.sage, T.gold, T.pink, T.red];

export const CAT_COLORS: Record<string, string> = {
  Botox: T.teal,
  Filler: T.tealLt,
  'Skin quality': T.pink,
  SkinQuality: T.pink,
  EBD: T.sage,
  Surgery: T.red,
  Other: T.gold,
};

export const CAT_BADGE: Record<string, string> = {
  Botox: 'bg-teal-100 text-teal-700',
  Filler: 'bg-cyan-100 text-cyan-700',
  'Skin quality': 'bg-pink-100 text-pink-700',
  EBD: 'bg-green-100 text-green-700',
  Surgery: 'bg-red-100 text-red-700',
  Other: 'bg-amber-100 text-amber-700',
};

// variant: 'white' | 'teal' | 'orange'
export default function KpiCard({
  icon, label, value, change, positiveUp = true,
  iconBg = '#E6F4F4', iconColor = '#2B8080', num,
  variant = 'white',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number;
  positiveUp?: boolean;
  iconBg?: string;
  iconColor?: string;
  num?: number;
  variant?: 'white' | 'teal' | 'orange';
}) {
  const isUp = (change ?? 0) >= 0;
  const isGood = positiveUp ? isUp : !isUp;

  const colored = variant !== 'white';
  const bg = variant === 'teal' ? T.teal : variant === 'orange' ? T.orange : undefined;

  return (
    <div
      className="rounded-2xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden"
      style={colored
        ? { background: bg, boxShadow: `0 4px 20px ${bg}55` }
        : { background: '#fff', border: '1px solid #f0edea' }
      }
    >
      {/* Decorative circle */}
      {colored && (
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20 bg-white" />
      )}

      {num !== undefined && (
        <span
          className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
          style={colored
            ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
            : { background: T.teal, color: '#fff' }
          }
        >
          {String(num).padStart(2, '0')}
        </span>
      )}

      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={colored
            ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
            : { background: iconBg, color: iconColor }
          }
        >
          {icon}
        </div>
        {change !== undefined && (
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${num !== undefined ? 'mr-8' : ''}`}
            style={colored
              ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
              : isGood
                ? { background: '#ECFDF5', color: '#065F46' }
                : { background: '#FEF2F2', color: '#991B1B' }
            }
          >
            {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      <p className={`text-[11px] font-bold mb-1 uppercase tracking-widest ${colored ? 'text-white/70' : 'text-stone-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-black tracking-tight ${colored ? 'text-white' : 'text-stone-800'}`}>
        {value}
      </p>
    </div>
  );
}
