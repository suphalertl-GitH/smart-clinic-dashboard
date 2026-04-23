import { NextRequest, NextResponse } from 'next/server';
import { claudeComplete } from '@/lib/claude';
import { supabaseAdmin } from '@/lib/supabase';
import { requireFeature } from '@/lib/tier';
import { getClinicId } from '@/lib/auth';

// POST /api/ai-summary
export async function POST(_req: NextRequest) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(clinicId, 'ai_summary');
  if (gate) return gate;
  try {
    // ดึงข้อมูลเดือนนี้
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    // Bangkok UTC+7 → start of month in UTC = day 1 at 17:00 previous day UTC
    const startOfMonthBkk = new Date(now.getFullYear(), now.getMonth(), 1); // midnight Bangkok
    const startOfMonthUTC = new Date(startOfMonthBkk.getTime() - 7 * 60 * 60 * 1000); // convert to UTC

    const [{ data: visits }, { data: patients }, { data: targetsData }, { data: clinicRow }] = await Promise.all([
      supabaseAdmin.from('visits').select('hn, treatment_name, price, sales_name, doctor, payment_method, customer_type, created_at')
        .eq('clinic_id', clinicId).gte('created_at', startOfMonthUTC.toISOString()).limit(500),
      supabaseAdmin.from('patients').select('source, sales_name, created_at')
        .eq('clinic_id', clinicId).limit(500),
      supabaseAdmin.from('sales_targets').select('sales_name, target').eq('clinic_id', clinicId),
      supabaseAdmin.from('clinics').select('name').eq('id', clinicId).single(),
    ]);

    const targetMap: Record<string, number> = {};
    for (const t of targetsData ?? []) targetMap[t.sales_name] = Number(t.target);
    const clinicName = clinicRow?.name || 'คลินิก';

    // ── Pre-compute stats so AI doesn't have to calculate ──
    const vList = visits ?? [];
    const totalRevenue = vList.reduce((s, v) => s + (parseFloat(String(v.price)) || 0), 0);
    const totalVisits = vList.length;
    const avgTicket = totalVisits > 0 ? Math.round(totalRevenue / totalVisits) : 0;

    // Revenue by sales
    const salesMap: Record<string, { revenue: number; visits: number }> = {};
    for (const v of vList) {
      const name = v.sales_name || 'ไม่ระบุ';
      if (!salesMap[name]) salesMap[name] = { revenue: 0, visits: 0 };
      salesMap[name].revenue += parseFloat(String(v.price)) || 0;
      salesMap[name].visits++;
    }
    const salesSummary = Object.entries(salesMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, d]) => {
        const tgt = targetMap[name] ?? 0;
        const pct = tgt > 0 ? ((d.revenue / tgt) * 100).toFixed(1) : '—';
        const tgtStr = tgt > 0 ? `${tgt.toLocaleString()} บาท (${pct}%)` : 'ยังไม่ตั้งเป้า';
        return `${name}: ${d.revenue.toLocaleString()} บาท (${d.visits} visits) | เป้า ${tgtStr}`;
      })
      .join('\n');

    // รวมเป้าจาก sales_targets ทั้งหมด (เฉพาะ sales ที่มี target) — ใช้แทน hardcode 3,600,000
    const totalTarget = Object.values(targetMap).reduce((s, t) => s + t, 0);
    const targetPctStr = totalTarget > 0 ? `${((totalRevenue / totalTarget) * 100).toFixed(1)}%` : '—';
    const targetLine = totalTarget > 0
      ? `เป้ายอดขายรวม (จาก Sales Target): ${totalTarget.toLocaleString()} บาท/เดือน\nสัดส่วนเป้า: ${targetPctStr}`
      : `ยังไม่มี Sales Target ถูกตั้งใน dashboard`;

    // Revenue by treatment
    const treatMap: Record<string, { revenue: number; visits: number }> = {};
    for (const v of vList) {
      const name = v.treatment_name || 'Other';
      if (!treatMap[name]) treatMap[name] = { revenue: 0, visits: 0 };
      treatMap[name].revenue += parseFloat(String(v.price)) || 0;
      treatMap[name].visits++;
    }
    const treatSummary = Object.entries(treatMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, d]) => `${name}: ${d.revenue.toLocaleString()} บาท (${d.visits} visits)`)
      .join('\n');

    // Revenue by doctor
    const docMap: Record<string, { revenue: number; visits: number }> = {};
    for (const v of vList) {
      const name = v.doctor || 'ไม่ระบุ';
      if (!docMap[name]) docMap[name] = { revenue: 0, visits: 0 };
      docMap[name].revenue += parseFloat(String(v.price)) || 0;
      docMap[name].visits++;
    }
    const docSummary = Object.entries(docMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, d]) => `${name}: ${d.revenue.toLocaleString()} บาท (${d.visits} visits)`)
      .join('\n');

    // Customer type
    const newCount = vList.filter(v => v.customer_type === 'new').length;
    const retCount = totalVisits - newCount;

    // Treatment bundle analysis — treatments done by the same HN in the same month
    const hnTreatMap: Record<string, Set<string>> = {};
    for (const v of vList) {
      const hn = v.hn || 'unknown';
      if (!hnTreatMap[hn]) hnTreatMap[hn] = new Set();
      if (v.treatment_name) hnTreatMap[hn].add(v.treatment_name);
    }
    // Count treatment pairs
    const pairMap: Record<string, number> = {};
    for (const treatments of Object.values(hnTreatMap)) {
      const arr = [...treatments];
      if (arr.length < 2) continue;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const pair = [arr[i], arr[j]].sort().join(' + ');
          pairMap[pair] = (pairMap[pair] || 0) + 1;
        }
      }
    }
    const topPairs = Object.entries(pairMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => `${pair} (${count} ราย)`)
      .join('\n');

    // Single-treatment HNs — potential upsell targets
    const singleTreatHNs = Object.entries(hnTreatMap).filter(([, s]) => s.size === 1);
    const singleTreatCount = singleTreatHNs.length;
    // Top treatments among single-treatment customers
    const singleTreatFreq: Record<string, number> = {};
    for (const [, s] of singleTreatHNs) {
      const t = [...s][0];
      singleTreatFreq[t] = (singleTreatFreq[t] || 0) + 1;
    }
    const singleTreatTop = Object.entries(singleTreatFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `${t} (${c} ราย)`)
      .join('\n');

    const prompt = `บทบาท: คุณเป็นที่ปรึกษาธุรกิจคลินิกความงาม (aesthetic clinic business consultant) มีประสบการณ์ 10+ ปี กับคลินิก boutique ในไทย
เข้าใจ economics ของธุรกิจนี้ — margin สูง, LTV ขึ้นอยู่กับ re-booking + treatment bundling, acquisition แพง ต้อง retention ดี
สไตล์การให้คำปรึกษา: ตรงประเด็น ให้ insight เชิง action ทันทีใช้ได้ ไม่ใช่แค่อ่านตัวเลขซ้ำ ใช้ศัพท์ธุรกิจคลินิก (course package, combo treatment, inactive patient, referral loop, margin mix) อ้างอิง industry benchmark ถ้าเหมาะสม

วิเคราะห์ข้อมูล ${clinicName} ประจำเดือนนี้ (ตัวเลขคำนวณแล้ว ห้ามคำนวณเอง):

=== สรุปยอดขาย ===
ยอดขายรวม: ${totalRevenue.toLocaleString()} บาท
จำนวน Visit: ${totalVisits} ครั้ง
Average Ticket: ${avgTicket.toLocaleString()} บาท
ลูกค้าใหม่: ${newCount} | ลูกค้าเก่า: ${retCount}
${targetLine}

=== ยอดขายตามเซลล์ (พร้อมเป้ารายคน) ===
${salesSummary || 'ไม่มีข้อมูล'}

=== ยอดขายตาม Treatment (Top 10) ===
${treatSummary || 'ไม่มีข้อมูล'}

=== ยอดขายตามแพทย์ ===
${docSummary || 'ไม่มีข้อมูล'}

=== Treatment Bundles ที่ลูกค้าทำคู่กันบ่อย ===
${topPairs || 'ไม่มีข้อมูล'}

=== ลูกค้าที่ทำ Treatment เดียว (โอกาส Upsell) ===
จำนวน: ${singleTreatCount} ราย
Treatment หลักที่ทำ:
${singleTreatTop || 'ไม่มีข้อมูล'}

วิเคราะห์ 3 ด้าน ใช้ตัวเลขด้านบนโดยตรง ห้ามคำนวณใหม่ ให้คำแนะนำระดับ consultant ที่เจ้าของคลินิกเอาไปสั่ง action ต่อได้เลย:

1. SALES PERFORMANCE — ดูเป้ารายคน: ใครทำเกินเป้า / ใครตาม / ใครวิกฤต ต้องทำยอดอีกเท่าไหร่ถึงสิ้นเดือน ถ้ามี "ไม่ระบุ" ยอดสูงแปลว่าข้อมูล sales_name ในชีตไม่ครบ flag ให้เจ้าของรู้
2. RETENTION — วิเคราะห์สัดส่วนลูกค้าใหม่/เก่า ถ้าใหม่เยอะ = acquisition cost สูง ควร re-booking ลูกค้าเก่า ถ้าเก่าเยอะ = pipeline ลูกค้าใหม่แห้ง แนะนำ channel acquisition / referral
3. UPSELL — อ้างอิง bundle pair จริงและ single-treatment cohort ออกเป็น "combo offer" ที่ชัด (ชื่อ treatment A + B) ระบุกลุ่มเป้าหมาย (HN ที่ทำ X แต่ไม่เคยทำ Y)

Focus items: 3-4 item ที่ execute ได้ ภายใน 7 วัน (ไม่ใช่ "เพิ่มยอดขาย" แบบกว้าง — ต้องเจาะเช่น "ส่ง LINE ลูกค้า Botox 21 คนที่ยังไม่เคยทำ Ultraformer offer combo 20% off")

ตอบเป็น JSON เท่านั้น รูปแบบ:
{
  "insights": [
    {"title": "SALES PERFORMANCE", "body": "insight 2-3 bullet · ใช้ตัวเลขจริง · อ้างชื่อเซลล์จริง", "color": "blue"},
    {"title": "RETENTION", "body": "insight 2-3 bullet · ระบุสัดส่วน · แนะ action", "color": "green"},
    {"title": "UPSELL OPPORTUNITIES", "body": "2-3 bullet · อ้าง bundle จริง + จำนวนลูกค้าเป้าหมาย", "color": "amber"}
  ],
  "focusItems": ["action เจาะจง 1", "action เจาะจง 2", "action เจาะจง 3"]
}`;

    const text = await claudeComplete(prompt);

    // Parse JSON from Claude response — sanitize control characters first
    const sanitized = text.replace(/[\x00-\x1F\x7F]/g, (ch) =>
      ch === '\n' || ch === '\r' || ch === '\t' ? ch : ' '
    );
    const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude ไม่ส่ง JSON กลับมา');
    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      insights: (parsed.insights ?? []).slice(0, 3),
      focusItems: (parsed.focusItems ?? []).slice(0, 4),
    });
  } catch (err: any) {
    // Fallback graceful error
    return NextResponse.json({
      insights: [{ title: 'ไม่สามารถวิเคราะห์ได้', body: err.message, color: 'amber' }],
      focusItems: [],
    });
  }
}
