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

export default function KpiCard({
  icon, label, value, change, positiveUp = true,
  iconBg = '#EEF2FF', iconColor = '#4F46E5', num,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number;
  positiveUp?: boolean;
  iconBg?: string;
  iconColor?: string;
  num?: number;
}) {
  const isUp = (change ?? 0) >= 0;
  const isGood = positiveUp ? isUp : !isUp;

  return (
    <div className="bg-white rounded-2xl p-5 border border-stone-100 hover:shadow-md transition-shadow relative overflow-hidden">
      {num !== undefined && (
        <span className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: '#4F46E5' }}>
          {String(num).padStart(2, '0')}
        </span>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        {change !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${num !== undefined ? 'mr-8' : ''} ${
            isGood ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
          }`}>
            {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold text-stone-400 mb-1 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-stone-800 tracking-tight">{value}</p>
    </div>
  );
}
