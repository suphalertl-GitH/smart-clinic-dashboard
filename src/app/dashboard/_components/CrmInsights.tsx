'use client';

import { useState, useEffect } from 'react';
import { Users, Star, AlertTriangle, Send, Crown, TrendingUp, RefreshCw } from 'lucide-react';
import { RadialBarChart, RadialBar, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const TIER_CONFIG = {
  platinum: { label: 'Platinum', color: '#7C3AED', emoji: '💎', min: 50000 },
  gold:     { label: 'Gold',     color: '#F59E0B', emoji: '🥇', min: 20000 },
  silver:   { label: 'Silver',   color: '#6B7280', emoji: '🥈', min: 5000  },
  bronze:   { label: 'Bronze',   color: '#92400E', emoji: '🥉', min: 0     },
};

export default function CrmInsights() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Campaign form
  const [campName, setCampName] = useState('');
  const [campMsg, setCampMsg] = useState('');
  const [campTier, setCampTier] = useState('');
  const [campMinDays, setCampMinDays] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/crm');
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function previewCampaign() {
    const params = new URLSearchParams({ preview: '1' });
    if (campTier) params.set('tier', campTier);
    if (campMinDays) params.set('minDays', campMinDays);
    const res = await fetch(`/api/crm/campaigns?${params}`);
    const json = await res.json();
    setPreviewCount(json.count ?? 0);
  }

  async function sendCampaign() {
    if (!campName || !campMsg) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campName, message: campMsg,
          targetTier: campTier || null,
          minDays: campMinDays ? parseInt(campMinDays) : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSendResult(`ส่งสำเร็จ ${json.sentCount} คน ✅`);
        setCampName(''); setCampMsg(''); setCampTier(''); setCampMinDays('');
        setPreviewCount(null);
        loadData();
      } else {
        setSendResult(`Error: ${json.error}`);
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400 gap-2">
        <RefreshCw size={20} className="animate-spin" /> กำลังโหลด CRM...
      </div>
    );
  }

  if (!data) return <div className="text-center text-stone-400 mt-20">ไม่สามารถโหลดข้อมูล CRM ได้</div>;

  const tierData = Object.entries(TIER_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    value: data.tierCount[key] ?? 0,
    color: cfg.color,
    emoji: cfg.emoji,
  })).filter(t => t.value > 0);

  const rfmColors: Record<string, string> = {
    champions: '#4F46E5', loyal: '#7C3AED', potential: '#06B6D4',
    new: '#10B981', need_attention: '#F59E0B', at_risk: '#EF4444', lost: '#9CA3AF',
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Users size={18} />} label="คนไข้ทั้งหมด" value={data.totalPatients} color="#4F46E5" />
        <KpiCard icon={<Crown size={18} />} label="เชื่อม LINE แล้ว" value={data.lineRegistered} color="#7C3AED" />
        <KpiCard icon={<AlertTriangle size={18} />} label="At Risk (>90วัน)" value={data.atRisk} color="#EF4444" />
        <KpiCard
          icon={<Star size={18} />}
          label="ความพึงพอใจเฉลี่ย"
          value={data.avgSatisfaction ? `${data.avgSatisfaction}/5` : 'N/A'}
          sub={data.totalSurveys ? `จาก ${data.totalSurveys} รีวิว` : ''}
          color="#F59E0B"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loyalty Tiers */}
        <div className="bg-white rounded-2xl p-5 border border-stone-100">
          <h3 className="text-sm font-bold text-stone-700 mb-4 flex items-center gap-2">
            <Crown size={15} className="text-indigo-500" /> Loyalty Tiers
          </h3>
          <div className="space-y-2">
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
              const count = data.tierCount[key] ?? 0;
              const pct = data.totalPatients > 0 ? Math.round((count / data.totalPatients) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-base w-6">{cfg.emoji}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-stone-700">{cfg.label}</span>
                      <span className="text-stone-500">{count} คน ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-stone-400 mt-3">Bronze &lt;5K · Silver 5K+ · Gold 20K+ · Platinum 50K+ บาท</p>
        </div>

        {/* RFM Segments */}
        <div className="bg-white rounded-2xl p-5 border border-stone-100">
          <h3 className="text-sm font-bold text-stone-700 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-purple-500" /> RFM Segments
          </h3>
          <div className="space-y-2">
            {(data.rfmSegments ?? []).map((seg: any) => {
              const pct = data.totalPatients > 0 ? Math.round((seg.count / data.totalPatients) * 100) : 0;
              return (
                <div key={seg.key} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-stone-700">{seg.label}</span>
                      <span className="text-stone-500">{seg.count} คน</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: seg.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-stone-400 mt-3">R = ความถี่ล่าสุด · F = จำนวนครั้ง · M = ยอดใช้จ่าย</p>
        </div>
      </div>

      {/* Smart Audience */}
      <div className="bg-white rounded-2xl p-5 border border-stone-100">
        <h3 className="text-sm font-bold text-stone-700 mb-1 flex items-center gap-2">
          <Users size={15} className="text-teal-500" /> Smart Audience — ระบบติดตามลูกค้าอัตโนมัติ
        </h3>
        <p className="text-xs text-stone-400 mb-4">แบ่งกลุ่มลูกค้าตามพฤติกรรม เพื่อทำ Campaign ได้ตรงจุด</p>

        <div className="mb-4">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Behavior Audience</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs text-stone-400 font-semibold pb-2">กลุ่มลูกค้า</th>
                  <th className="text-center text-xs text-stone-400 font-semibold pb-2 w-16">จำนวน</th>
                  <th className="text-left text-xs text-stone-400 font-semibold pb-2">คำอธิบาย</th>
                  <th className="w-8 pb-2" />
                </tr>
              </thead>
              <tbody>
                {(data.smartAudience?.behavior ?? []).map((seg: any) => (
                  <tr key={seg.key} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                        <span className="font-semibold text-stone-700 text-xs">{seg.label}</span>
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <span className="font-black text-base" style={{ color: seg.color }}>{seg.count}</span>
                    </td>
                    <td className="py-2 text-xs text-stone-400">{seg.desc}</td>
                    <td className="py-2">
                      <button
                        title="ส่ง Campaign ให้กลุ่มนี้"
                        onClick={() => {
                          setCampTier('');
                          setCampName(`Campaign: ${seg.label}`);
                          document.getElementById('campaign-msg')?.focus();
                        }}
                        className="text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        <Send size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Segment Audience (RFM)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs text-stone-400 font-semibold pb-2">กลุ่มลูกค้า</th>
                  <th className="text-center text-xs text-stone-400 font-semibold pb-2 w-16">จำนวน</th>
                  <th className="text-left text-xs text-stone-400 font-semibold pb-2">คำอธิบาย</th>
                </tr>
              </thead>
              <tbody>
                {(data.smartAudience?.segment ?? []).map((seg: any) => (
                  <tr key={seg.key} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                        <span className="font-semibold text-stone-700 text-xs">{seg.label}</span>
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <span className="font-black text-base" style={{ color: seg.color }}>{seg.count}</span>
                    </td>
                    <td className="py-2 text-xs text-stone-400">{seg.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-stone-400 mt-2">R = Recency · F = Frequency · M = Monetary</p>
        </div>
      </div>

      {/* Cohort Analysis */}
      <div className="bg-white rounded-2xl p-5 border border-stone-100">
        <h3 className="text-sm font-bold text-stone-700 mb-1 flex items-center gap-2">
          <TrendingUp size={15} className="text-purple-500" /> Cohort Analysis
        </h3>
        <p className="text-xs text-stone-400 mb-4">พฤติกรรมการใช้บริการในมิติของความถี่และกำลังซื้อในแต่ละครั้ง</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-stone-500 font-semibold pb-2 pr-4">ความถี่ \ ยอดใช้จ่าย</th>
                {(data.cohort?.[0]?.cells ?? []).map((c: any) => (
                  <th key={c.label} className="text-center text-stone-500 font-semibold pb-2 px-3">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.cohort ?? []).map((row: any) => {
                const rowMax = Math.max(...row.cells.map((c: any) => c.count), 1);
                return (
                  <tr key={row.label} className="border-t border-stone-50">
                    <td className="py-2 pr-4 font-semibold text-stone-600">{row.label}</td>
                    {row.cells.map((cell: any) => {
                      const intensity = cell.count === 0 ? 0 : Math.max(0.1, cell.count / rowMax);
                      return (
                        <td key={cell.label} className="py-2 px-3 text-center">
                          <div
                            className="rounded-lg py-1.5 px-2 font-bold transition-all"
                            style={{
                              background: cell.count === 0 ? '#F9FAFB' : `rgba(79,70,229,${intensity * 0.8})`,
                              color: intensity > 0.5 ? '#fff' : cell.count === 0 ? '#D1D5DB' : '#4F46E5',
                            }}
                          >
                            {cell.count}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-stone-400 mt-2">สีเข้ม = คนไข้กลุ่มใหญ่</p>
      </div>

      {/* Satisfaction Survey Distribution */}
      {data.totalSurveys > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-stone-100">
          <h3 className="text-sm font-bold text-stone-700 mb-4 flex items-center gap-2">
            <Star size={15} className="text-yellow-500" /> ผลสำรวจความพึงพอใจ
          </h3>
          <div className="flex items-center gap-6">
            <div className="text-center shrink-0">
              <div className="text-4xl font-black" style={{ color: '#4F46E5' }}>{data.avgSatisfaction}</div>
              <div className="text-xs text-stone-400">/ 5.0</div>
              <div className="text-yellow-400 text-lg mt-1">{'⭐'.repeat(Math.round(data.avgSatisfaction ?? 0))}</div>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map(s => {
                const item = (data.scoreDistrib ?? []).find((d: any) => d.score === s);
                const count = item?.count ?? 0;
                const pct = data.totalSurveys > 0 ? Math.round((count / data.totalSurveys) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right text-stone-500">{s}</span>
                    <span className="text-yellow-400">⭐</span>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-stone-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top Spenders */}
      <div className="bg-white rounded-2xl p-5 border border-stone-100">
        <h3 className="text-sm font-bold text-stone-700 mb-4">🏆 Top Spenders</h3>
        <div className="space-y-2">
          {(data.topSpenders ?? []).map((p: any, i: number) => {
            const cfg = TIER_CONFIG[p.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.bronze;
            return (
              <div key={p.hn} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                <span className="w-5 text-xs font-bold text-stone-400">#{i + 1}</span>
                <span className="text-sm">{cfg.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-stone-800">{p.name}</p>
                  <p className="text-xs text-stone-400">{p.hn} · {p.points} แต้ม</p>
                </div>
                <span className="text-sm font-bold" style={{ color: cfg.color }}>
                  ฿{Number(p.spending).toLocaleString()}
                </span>
              </div>
            );
          })}
          {(data.topSpenders ?? []).length === 0 && (
            <p className="text-sm text-stone-400 text-center py-4">ยังไม่มีข้อมูล</p>
          )}
        </div>
      </div>

      {/* Campaign Sender */}
      <div className="bg-white rounded-2xl p-5 border border-stone-100">
        <h3 className="text-sm font-bold text-stone-700 mb-4 flex items-center gap-2">
          <Send size={15} className="text-indigo-500" /> ส่ง Campaign ผ่าน LINE
        </h3>
        <div className="space-y-3">
          <input
            value={campName}
            onChange={e => setCampName(e.target.value)}
            placeholder="ชื่อ Campaign เช่น Botox Promo April"
            className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          />
          <textarea
            id="campaign-msg"
            value={campMsg}
            onChange={e => setCampMsg(e.target.value)}
            placeholder="ข้อความที่จะส่งผ่าน LINE..."
            rows={3}
            className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">กลุ่มเป้าหมาย (Tier)</label>
              <select
                value={campTier}
                onChange={e => setCampTier(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              >
                <option value="">ทุก Tier</option>
                <option value="platinum">💎 Platinum</option>
                <option value="gold">🥇 Gold</option>
                <option value="silver">🥈 Silver</option>
                <option value="bronze">🥉 Bronze</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">ไม่มาใช้บริการ (วัน)</label>
              <input
                type="number"
                value={campMinDays}
                onChange={e => setCampMinDays(e.target.value)}
                placeholder="เช่น 60"
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={previewCampaign}
              className="px-4 py-2 border border-indigo-300 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors"
            >
              Preview กลุ่มเป้าหมาย
            </button>
            {previewCount !== null && (
              <span className="text-sm font-bold text-indigo-600">{previewCount} คนที่จะได้รับ</span>
            )}
            <button
              onClick={sendCampaign}
              disabled={sending || !campName || !campMsg}
              className="ml-auto px-5 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
              style={{ background: '#4F46E5' }}
            >
              {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              ส่ง Campaign
            </button>
          </div>
          {sendResult && (
            <p className="text-sm font-semibold text-center py-2 rounded-xl bg-indigo-50 text-indigo-700">{sendResult}</p>
          )}
        </div>
      </div>

      {/* Campaign History */}
      {(data.campaigns ?? []).length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-stone-100">
          <h3 className="text-sm font-bold text-stone-700 mb-4">📋 ประวัติ Campaign</h3>
          <div className="space-y-2">
            {data.campaigns.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-stone-800">{c.name}</p>
                  <p className="text-xs text-stone-400">
                    {c.target_tier ? `Tier: ${c.target_tier}` : 'ทุก Tier'} ·{' '}
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString('th-TH') : 'draft'}
                  </p>
                </div>
                <span className="text-sm font-bold text-indigo-600">{c.sent_count} คน</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-stone-100">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs text-stone-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-black text-stone-800">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}
