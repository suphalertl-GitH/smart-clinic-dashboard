'use client';

import { useState, useEffect } from 'react';
import { Users, Star, AlertTriangle, Send, Crown, TrendingUp, RefreshCw, Target } from 'lucide-react';

// ── Theme constants (ตาม MedCare teal theme) ─────────────────
const PRIMARY   = '#0f4c5c';
const ACCENT    = '#e36414';
const PRIMARY_L = '#1a6b7a';

const TIER_CONFIG = {
  platinum: { label: 'Platinum', color: '#7C3AED', emoji: '💎' },
  gold:     { label: 'Gold',     color: '#D97706', emoji: '🥇' },
  silver:   { label: 'Silver',   color: '#64748B', emoji: '🥈' },
  bronze:   { label: 'Bronze',   color: '#92400E', emoji: '🥉' },
};

export default function CrmInsights() {
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [campName, setCampName] = useState('');
  const [campMsg, setCampMsg]   = useState('');
  const [campTier, setCampTier] = useState('');
  const [campMinDays, setCampMinDays] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sending, setSending]   = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try { setData(await (await fetch('/api/crm')).json()); }
    finally { setLoading(false); }
  }

  async function previewCampaign() {
    const p = new URLSearchParams({ preview: '1' });
    if (campTier)    p.set('tier', campTier);
    if (campMinDays) p.set('minDays', campMinDays);
    const json = await (await fetch(`/api/crm/campaigns?${p}`)).json();
    setPreviewCount(json.count ?? 0);
  }

  async function sendCampaign() {
    if (!campName || !campMsg) return;
    setSending(true); setSendResult(null);
    try {
      const json = await (await fetch('/api/crm/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campName, message: campMsg, targetTier: campTier || null, minDays: campMinDays ? parseInt(campMinDays) : null }),
      })).json();
      if (json.success) {
        setSendResult(`ส่งสำเร็จ ${json.sentCount} คน ✅`);
        setCampName(''); setCampMsg(''); setCampTier(''); setCampMinDays(''); setPreviewCount(null);
        loadData();
      } else setSendResult(`Error: ${json.error}`);
    } finally { setSending(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
      <RefreshCw size={20} className="animate-spin" /> กำลังโหลด CRM...
    </div>
  );
  if (!data) return <div className="text-center text-slate-400 mt-20">ไม่สามารถโหลดข้อมูล CRM ได้</div>;

  return (
    <div className="space-y-5">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKpi icon={<Users size={18} />}         label="คนไข้ทั้งหมด"       value={data.totalPatients}   iconBg="#E6F4F4" iconColor={PRIMARY} />
        <MiniKpi icon={<Crown size={18} />}          label="เชื่อม LINE แล้ว"   value={data.lineRegistered}  iconBg="#FEF3EE" iconColor={ACCENT} />
        <MiniKpi icon={<AlertTriangle size={18} />}  label="At Risk (>90 วัน)"  value={data.atRisk}          iconBg="#FEF2F2" iconColor="#DC2626" />
        <MiniKpi
          icon={<Star size={18} />}
          label="ความพึงพอใจ"
          value={data.avgSatisfaction ? `${data.avgSatisfaction}/5` : 'N/A'}
          sub={data.totalSurveys ? `จาก ${data.totalSurveys} รีวิว` : ''}
          iconBg="#FFFBEB" iconColor="#D97706"
        />
      </div>

      {/* ── Loyalty Tiers + RFM ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Loyalty Tiers */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm card-hover">
          <SectionTitle icon={<Crown size={14} />} title="Loyalty Tiers" color={PRIMARY} />
          <div className="space-y-3 mt-4">
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
              const count = data.tierCount[key] ?? 0;
              const pct = data.totalPatients > 0 ? Math.round((count / data.totalPatients) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-base w-6 shrink-0">{cfg.emoji}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">{cfg.label}</span>
                      <span className="text-slate-400">{count} คน ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-3">Bronze &lt;5K · Silver 5K+ · Gold 20K+ · Platinum 50K+ บาท</p>
        </div>

        {/* RFM Segments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm card-hover">
          <SectionTitle icon={<TrendingUp size={14} />} title="RFM Segments" color={PRIMARY_L} />
          <div className="space-y-2.5 mt-4">
            {(data.rfmSegments ?? []).map((seg: any) => {
              const pct = data.totalPatients > 0 ? Math.round((seg.count / data.totalPatients) * 100) : 0;
              return (
                <div key={seg.key} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">{seg.label}</span>
                      <span className="text-slate-400">{seg.count} คน</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: seg.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-3">R = Recency · F = Frequency · M = Monetary</p>
        </div>
      </div>

      {/* ── Smart Audience ── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <SectionTitle icon={<Target size={14} />} title="Smart Audience — ระบบติดตามลูกค้าอัตโนมัติ" color={PRIMARY} />
        <p className="text-xs text-slate-400 mt-1 mb-4">แบ่งกลุ่มลูกค้าตามพฤติกรรม เพื่อทำ Campaign ได้ตรงจุด</p>

        {/* Behavior */}
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Behavior Audience</p>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs text-slate-400 font-semibold pb-2">กลุ่มลูกค้า</th>
                <th className="text-center text-xs text-slate-400 font-semibold pb-2 w-16">จำนวน</th>
                <th className="text-left text-xs text-slate-400 font-semibold pb-2">คำอธิบาย</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {(data.smartAudience?.behavior ?? []).map((seg: any) => (
                <tr key={seg.key} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                      <span className="font-semibold text-slate-700 text-xs">{seg.label}</span>
                    </div>
                  </td>
                  <td className="py-2 text-center font-black text-base" style={{ color: seg.color }}>{seg.count}</td>
                  <td className="py-2 text-xs text-slate-400">{seg.desc}</td>
                  <td className="py-2">
                    <button
                      title="ส่ง Campaign"
                      onClick={() => { setCampTier(''); setCampName(`Campaign: ${seg.label}`); document.getElementById('campaign-msg')?.focus(); }}
                      className="hover:opacity-70 transition-opacity"
                      style={{ color: PRIMARY }}
                    >
                      <Send size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Segment (RFM) */}
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Segment Audience (RFM)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs text-slate-400 font-semibold pb-2">กลุ่มลูกค้า</th>
                <th className="text-center text-xs text-slate-400 font-semibold pb-2 w-16">จำนวน</th>
                <th className="text-left text-xs text-slate-400 font-semibold pb-2">คำอธิบาย</th>
              </tr>
            </thead>
            <tbody>
              {(data.smartAudience?.segment ?? []).map((seg: any) => (
                <tr key={seg.key} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                      <span className="font-semibold text-slate-700 text-xs">{seg.label}</span>
                    </div>
                  </td>
                  <td className="py-2 text-center font-black text-base" style={{ color: seg.color }}>{seg.count}</td>
                  <td className="py-2 text-xs text-slate-400">{seg.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">R = Recency · F = Frequency · M = Monetary</p>
      </div>

      {/* ── Cohort Analysis ── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <SectionTitle icon={<TrendingUp size={14} />} title="Cohort Analysis" color={PRIMARY_L} />
        <p className="text-xs text-slate-400 mt-1 mb-4">ความถี่การใช้บริการ × กำลังซื้อ</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-slate-500 font-semibold pb-2 pr-4">ความถี่ \ ยอดใช้จ่าย</th>
                {(data.cohort?.[0]?.cells ?? []).map((c: any) => (
                  <th key={c.label} className="text-center text-slate-500 font-semibold pb-2 px-3">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.cohort ?? []).map((row: any) => {
                const rowMax = Math.max(...row.cells.map((c: any) => c.count), 1);
                return (
                  <tr key={row.label} className="border-t border-slate-50">
                    <td className="py-2 pr-4 font-semibold text-slate-600">{row.label}</td>
                    {row.cells.map((cell: any) => {
                      const intensity = cell.count === 0 ? 0 : Math.max(0.12, cell.count / rowMax);
                      return (
                        <td key={cell.label} className="py-1.5 px-3 text-center">
                          <div
                            className="rounded-lg py-1.5 px-2 font-bold transition-all"
                            style={{
                              background: cell.count === 0 ? '#F8FAFC' : `rgba(15,76,92,${intensity * 0.85})`,
                              color: intensity > 0.45 ? '#fff' : cell.count === 0 ? '#CBD5E1' : PRIMARY,
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
        <p className="text-[10px] text-slate-400 mt-2">สีเข้ม = คนไข้กลุ่มใหญ่</p>
      </div>

      {/* ── Satisfaction Survey ── */}
      {data.totalSurveys > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <SectionTitle icon={<Star size={14} />} title="ผลสำรวจความพึงพอใจ" color="#D97706" />
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center shrink-0">
              <div className="text-4xl font-heading font-black" style={{ color: PRIMARY }}>{data.avgSatisfaction}</div>
              <div className="text-xs text-slate-400">/ 5.0</div>
              <div className="text-yellow-400 text-lg mt-1">{'⭐'.repeat(Math.round(data.avgSatisfaction ?? 0))}</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map(s => {
                const count = (data.scoreDistrib ?? []).find((d: any) => d.score === s)?.count ?? 0;
                const pct = data.totalSurveys > 0 ? Math.round((count / data.totalSurveys) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right text-slate-500">{s}</span>
                    <span className="text-yellow-400">⭐</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-5 text-slate-400 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Spenders ── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <SectionTitle icon={<Crown size={14} />} title="🏆 Top Spenders" color={PRIMARY} />
        <div className="space-y-2 mt-4">
          {(data.topSpenders ?? []).map((p: any, i: number) => {
            const cfg = TIER_CONFIG[p.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.bronze;
            return (
              <div key={p.hn} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: cfg.color }}>
                  {i + 1}
                </div>
                <span className="text-sm shrink-0">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.hn} · {p.points} แต้ม</p>
                </div>
                <span className="text-sm font-bold shrink-0" style={{ color: PRIMARY }}>
                  ฿{Number(p.spending).toLocaleString()}
                </span>
              </div>
            );
          })}
          {(data.topSpenders ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีข้อมูล</p>
          )}
        </div>
      </div>

      {/* ── Campaign Sender ── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <SectionTitle icon={<Send size={14} />} title="ส่ง Campaign ผ่าน LINE" color={ACCENT} />
        <div className="space-y-3 mt-4">
          <input
            value={campName} onChange={e => setCampName(e.target.value)}
            placeholder="ชื่อ Campaign เช่น Botox Promo April"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          <textarea
            id="campaign-msg" value={campMsg} onChange={e => setCampMsg(e.target.value)}
            placeholder="ข้อความที่จะส่งผ่าน LINE..." rows={3}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">กลุ่มเป้าหมาย (Tier)</label>
              <select value={campTier} onChange={e => setCampTier(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white">
                <option value="">ทุก Tier</option>
                <option value="platinum">💎 Platinum</option>
                <option value="gold">🥇 Gold</option>
                <option value="silver">🥈 Silver</option>
                <option value="bronze">🥉 Bronze</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">ไม่มาใช้บริการ (วัน)</label>
              <input type="number" value={campMinDays} onChange={e => setCampMinDays(e.target.value)}
                placeholder="เช่น 60"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={previewCampaign}
              className="px-4 py-2 border rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
              style={{ borderColor: PRIMARY, color: PRIMARY }}>
              Preview กลุ่มเป้าหมาย
            </button>
            {previewCount !== null && (
              <span className="text-sm font-bold" style={{ color: PRIMARY }}>{previewCount} คนที่จะได้รับ</span>
            )}
            <button onClick={sendCampaign} disabled={sending || !campName || !campMsg}
              className="ml-auto px-5 py-2 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-opacity flex items-center gap-2"
              style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_L})` }}>
              {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              ส่ง Campaign
            </button>
          </div>
          {sendResult && (
            <p className="text-sm font-semibold text-center py-2 rounded-xl"
              style={{ background: '#E6F4F4', color: PRIMARY }}>{sendResult}</p>
          )}
        </div>
      </div>

      {/* ── Campaign History ── */}
      {(data.campaigns ?? []).length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <SectionTitle icon={<Send size={14} />} title="📋 ประวัติ Campaign" color={PRIMARY} />
          <div className="space-y-2 mt-4">
            {data.campaigns.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.target_tier ? `Tier: ${c.target_tier}` : 'ทุก Tier'} · {c.sent_at ? new Date(c.sent_at).toLocaleDateString('th-TH') : 'draft'}
                  </p>
                </div>
                <span className="text-sm font-bold" style={{ color: PRIMARY }}>{c.sent_count} คน</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────
function SectionTitle({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <h3 className="text-sm font-heading font-semibold flex items-center gap-2" style={{ color: '#1e293b' }}>
      <span style={{ color }}>{icon}</span>
      {title}
    </h3>
  );
}

function MiniKpi({ icon, label, value, sub, iconBg, iconColor }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm card-hover">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <p className="text-2xl font-heading font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
