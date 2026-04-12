import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { pushMessage, textMessage, flexMessage } from '@/lib/line';
import { requireTier } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const CLINIC = { name: 'พลอยใสคลินิก', phone: '065-553-9361' };

// GET /api/cron/followup — เรียกจาก Vercel Cron ทุกวัน 10:00 Thai
// vercel.json schedule: "0 3 * * *" (UTC 03:00 = Thai 10:00)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await requireTier(CLINIC_ID, 'enterprise');
  if (gate) return NextResponse.json({ skipped: 'tier < enterprise' }, { status: 200 });

  try {
    // ดึง treatment cycles จาก settings
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('treatment_cycles')
      .eq('clinic_id', CLINIC_ID)
      .single();

    const cycles: { treatment: string; days: number }[] = settings?.treatment_cycles ?? [];
    if (cycles.length === 0) {
      return NextResponse.json({ sent: 0, message: 'ไม่มี treatment cycles ใน settings' });
    }

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const todayStr = now.toISOString().split('T')[0];

    let totalSent = 0;
    const errors: string[] = [];

    for (const cycle of cycles) {
      // หา visits ที่ทำ treatment นี้ และครบ cycle แล้ว (± 3 วัน window)
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() - cycle.days);
      const windowStart = new Date(dueDate);
      windowStart.setDate(windowStart.getDate() - 3);
      const windowEnd = new Date(dueDate);
      windowEnd.setDate(windowEnd.getDate() + 3);

      const { data: dueVisits } = await supabaseAdmin
        .from('visits')
        .select('id, hn, treatment_name, created_at')
        .eq('clinic_id', CLINIC_ID)
        .ilike('treatment_name', `%${cycle.treatment}%`)
        .gte('created_at', windowStart.toISOString())
        .lte('created_at', windowEnd.toISOString());

      if (!dueVisits || dueVisits.length === 0) continue;

      for (const visit of dueVisits) {
        // ดึงข้อมูลคนไข้ที่มี line_user_id
        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('full_name, line_user_id, loyalty_tier')
          .eq('clinic_id', CLINIC_ID)
          .eq('hn', visit.hn)
          .not('line_user_id', 'is', null)
          .single();

        if (!patient?.line_user_id) continue;

        // เช็คว่าเคยส่ง followup นี้ไปแล้วหรือยัง (ป้องกัน duplicate)
        const { data: alreadySent } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('clinic_id', CLINIC_ID)
          .eq('patient_id', visit.hn)
          .eq('type', 'followup')
          .gte('sent_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
          .limit(1);

        if (alreadySent && alreadySent.length > 0) continue;

        try {
          const tierLabel = tierEmoji(patient.loyalty_tier);
          const msg = followupFlex({
            name: patient.full_name,
            treatment: cycle.treatment,
            daysSince: cycle.days,
            tier: tierLabel,
            clinicName: CLINIC.name,
            clinicPhone: CLINIC.phone,
          });

          await pushMessage(patient.line_user_id, [msg]);

          await supabaseAdmin.from('notifications').insert({
            clinic_id: CLINIC_ID,
            appointment_id: null,
            patient_id: null,
            line_user_id: patient.line_user_id,
            type: 'followup',
            message: `followup: ${cycle.treatment} (${cycle.days}d)`,
            status: 'sent',
            scheduled_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
          });

          totalSent++;
        } catch (err: any) {
          errors.push(`${visit.hn}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({ success: true, sent: totalSent, date: todayStr, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function tierEmoji(tier: string) {
  const map: Record<string, string> = {
    platinum: '💎 Platinum',
    gold: '🥇 Gold',
    silver: '🥈 Silver',
    bronze: '🥉 Bronze',
  };
  return map[tier] ?? '🥉 Bronze';
}

function followupFlex(data: {
  name: string;
  treatment: string;
  daysSince: number;
  tier: string;
  clinicName: string;
  clinicPhone: string;
}) {
  return flexMessage(`ถึงเวลา ${data.treatment} แล้วนะคะ`, {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#4F46E5',
      contents: [
        { type: 'text', text: '✨ ถึงเวลาดูแลผิวแล้วนะคะ', color: '#ffffff', weight: 'bold', size: 'md' },
        { type: 'text', text: data.clinicName, color: '#c7d2fe', size: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: `สวัสดีคุณ${data.name} ${data.tier}`, weight: 'bold', size: 'md' },
        {
          type: 'text',
          text: `ครบ ${data.daysSince} วันแล้วนะคะ ถึงเวลา${data.treatment}รอบใหม่เพื่อผลลัพธ์ที่ดีที่สุด 💉`,
          wrap: true, color: '#555555', size: 'sm',
        },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: `📞 โทรนัด: ${data.clinicPhone}`, color: '#888888', size: 'xs', margin: 'md' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button', style: 'primary', color: '#4F46E5',
          action: { type: 'message', label: `นัด${data.treatment}เลย 📅`, text: `อยากนัด${data.treatment}` },
        },
      ],
    },
  });
}
