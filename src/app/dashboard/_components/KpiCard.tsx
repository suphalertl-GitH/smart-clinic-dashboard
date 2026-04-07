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
  icon, label, value, change, positiveUp = true, iconBg = 'bg-blue-50', iconColor = 'text-blue-600',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number;
  positiveUp?: boolean;
  iconBg?: string;
  iconColor?: string;
}) {
  const isUp = (change ?? 0) >= 0;
  const isGood = positiveUp ? isUp : !isUp;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        {change !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-0.5 ${
            isGood
              ? 'text-green-700 bg-green-50'
              : 'text-red-600 bg-red-50'
          }`}>
            {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}
