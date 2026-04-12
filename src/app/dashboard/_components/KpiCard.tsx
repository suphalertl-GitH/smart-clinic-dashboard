function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

export function fmt(v: number) {
  return v >= 1_000_000 ? `฿${(v / 1_000_000).toFixed(1)}M`
    : `฿${v.toLocaleString('en-US')}`;
}

export function calcPct(cur: number, prev: number) { return pct(cur, prev); }

// ── Shared palette (charts, tables) ──────────────────────────
export const T = {
  teal:     '#0f4c5c',
  tealMid:  '#1a6b7a',
  orange:   '#e36414',
  sage:     '#5FAD82',
  gold:     '#D4A853',
  pink:     '#D46B8A',
  red:      '#D44A4A',
  cyan:     '#0891b2',
};

export const CHART_COLORS = [T.teal, T.orange, T.sage, T.gold, T.pink, T.red, T.cyan];

// Category-neutral colours that complement any theme's primary/accent
const NEUTRAL_EXTRAS = [T.sage, T.gold, T.pink, T.red, T.cyan, '#6366f1'];

/** Returns a palette where [0]=theme.bg [1]=theme.accent then neutral fillers */
export function themeChartColors(theme: { bg: string; accent: string }): string[] {
  return [theme.bg, theme.accent, ...NEUTRAL_EXTRAS];
}

export const CAT_COLORS: Record<string, string> = {
  Botox:          T.teal,
  Filler:         T.tealMid,
  'Skin quality': T.pink,
  SkinQuality:    T.pink,
  EBD:            T.sage,
  Surgery:        T.red,
  Other:          T.gold,
};

export const CAT_BADGE: Record<string, string> = {
  Botox:          'bg-teal-100 text-teal-700',
  Filler:         'bg-cyan-100 text-cyan-700',
  'Skin quality': 'bg-pink-100 text-pink-700',
  EBD:            'bg-green-100 text-green-700',
  Surgery:        'bg-red-100 text-red-700',
  Other:          'bg-amber-100 text-amber-700',
};

// ── KpiCard ───────────────────────────────────────────────────
// variant: 'white' | 'primary' | 'accent'
// For colored cards, pass gradient (CSS string) from theme
export default function KpiCard({
  icon, label, value, change, positiveUp = true,
  iconBg = '#E6F4F4', iconColor = T.teal,
  variant = 'white',
  gradient,          // CSS gradient for colored cards
  badge,             // small badge text (e.g. "+12%" or "วันนี้")
  animClass,         // e.g. "fade-in fade-in-d1"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number;
  positiveUp?: boolean;
  iconBg?: string;
  iconColor?: string;
  variant?: 'white' | 'colored';
  gradient?: string;
  badge?: string;
  animClass?: string;
}) {
  const isUp   = (change ?? 0) >= 0;
  const isGood = positiveUp ? isUp : !isUp;
  const colored = variant === 'colored';

  return (
    <div
      className={`stat-glow card-hover rounded-2xl p-5 relative overflow-hidden ${animClass ?? ''}`}
      style={colored
        ? { background: gradient ?? `linear-gradient(135deg, ${T.teal}, ${T.tealMid})`, color: '#fff' }
        : { background: '#fff', border: '1px solid #e2e8f0' }
      }
    >
      {/* Top row: icon + badge */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={colored
            ? { background: 'rgba(255,255,255,0.18)' }
            : { background: iconBg, color: iconColor }
          }
        >
          {icon}
        </div>

        {/* Badge: priority → explicit badge > change % */}
        {badge ? (
          <span className="text-xs px-2.5 py-1 rounded-full"
            style={colored ? { background: 'rgba(255,255,255,0.18)' } : { background: '#f1f5f9', color: '#64748b' }}
          >{badge}</span>
        ) : change !== undefined ? (
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={colored
              ? { background: 'rgba(255,255,255,0.22)', color: '#fff' }
              : isGood
                ? { background: '#ECFDF5', color: '#065F46' }
                : { background: '#FEF2F2', color: '#991B1B' }
            }
          >
            {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        ) : null}
      </div>

      {/* Value */}
      <p className={`text-2xl font-heading font-bold tracking-tight ${colored ? 'text-white' : 'text-slate-800'}`}>
        {value}
      </p>
      {/* Label */}
      <p className={`text-sm mt-0.5 ${colored ? 'text-white/60' : 'text-slate-500'}`}>
        {label}
      </p>
    </div>
  );
}
