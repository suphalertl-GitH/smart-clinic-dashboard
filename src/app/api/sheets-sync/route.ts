import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const SYNC_SECRET = process.env.CRON_SECRET ?? 'clinic2026secret';

// POST /api/sheets-sync — รับข้อมูลจาก Google Apps Script
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ตรวจ secret key
    if (body.secret !== SYNC_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, data } = body; // type: 'patient' | 'visit' | 'bulk'

    if (type === 'patient' && data) {
      const result = await upsertPatient(data);
      return NextResponse.json({ success: true, result });
    }

    if (type === 'visit' && data) {
      const result = await upsertVisit(data);
      return NextResponse.json({ success: true, result });
    }

    if (type === 'bulk' && data) {
      const stats = { patients: { added: 0, updated: 0 }, visits: { added: 0, updated: 0 }, appointments: { added: 0, skipped: 0 } };

      // Batch upsert patients
      const rawPatients = data.patients ?? [];
      if (rawPatients.length > 0) {
        const rows = rawPatients.filter((p: any) => p.hn?.trim()).map((p: any) => {
          let created_at: string | undefined;
          if (p.timestamp || p.created_at) {
            const d = new Date(p.timestamp || p.created_at);
            if (!isNaN(d.getTime())) created_at = d.toISOString();
          }
          const row: any = {
            clinic_id: CLINIC_ID,
            hn: p.hn.trim(),
            full_name: p.full_name?.trim() || p.name?.trim() || '',
            phone: p.phone?.trim() || '',
            allergies: p.allergies?.trim() || null,
            disease: p.disease?.trim() || null,
            face_image_url: p.face_image_url || null,
            source: p.source?.trim() || null,
            sales_name: p.sales_name?.trim() || null,
            consent_image_url: p.consent_image_url || null,
          };
          if (created_at) row.created_at = created_at;
          return row;
        });
        const { error } = await supabaseAdmin.from('patients').upsert(rows, { onConflict: 'clinic_id,hn' });
        if (error) console.error('Batch patient upsert error:', error.message);
        stats.patients.updated = rows.length;
      }

      // Visits still one-by-one (dedup logic needed)
      for (const v of data.visits ?? []) {
        const r = await upsertVisit(v);
        if (r === 'added') stats.visits.added++;
        else if (r === 'updated') stats.visits.updated++;
        if (v.appt_date) {
          const ar = await upsertAppointment(v);
          if (ar === 'added') stats.appointments.added++;
          else stats.appointments.skipped++;
        }
      }

      return NextResponse.json({ success: true, stats });
    }

    return NextResponse.json({ error: 'Invalid type — use patient, visit, or bulk' }, { status: 400 });
  } catch (err: any) {
    console.error('Sheets sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/sheets-sync — ดึงข้อมูลจาก Supabase (สำหรับ Apps Script ดึงกลับ)
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get('type') ?? 'all';

  const result: any = {};

  if (type === 'patients' || type === 'all') {
    const { data } = await supabaseAdmin
      .from('patients').select('hn, full_name, phone, allergies, disease, source, sales_name, created_at')
      .eq('clinic_id', CLINIC_ID).order('hn');
    result.patients = data ?? [];
  }

  if (type === 'visits' || type === 'all') {
    const { data } = await supabaseAdmin
      .from('visits').select('hn, treatment_name, price, doctor, sales_name, customer_type, payment_method, appt_date, appt_time, created_at')
      .eq('clinic_id', CLINIC_ID).order('created_at', { ascending: false }).limit(500);
    result.visits = data ?? [];
  }

  return NextResponse.json(result);
}

// ── Helpers ────────────────────────────────────────────────
async function upsertPatient(p: any): Promise<'added' | 'updated'> {
  const hn = p.hn?.trim();
  if (!hn) throw new Error('Missing HN');

  // Parse timestamp from Sheet if provided
  let created_at: string | undefined;
  if (p.timestamp || p.created_at) {
    const raw = p.timestamp || p.created_at;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) created_at = d.toISOString();
  }

  const row: any = {
    clinic_id: CLINIC_ID,
    hn,
    full_name: p.full_name?.trim() || p.name?.trim() || '',
    phone: p.phone?.trim() || '',
    allergies: p.allergies?.trim() || null,
    disease: p.disease?.trim() || null,
    face_image_url: p.face_image_url || null,
    source: p.source?.trim() || null,
    sales_name: p.sales_name?.trim() || null,
    consent_image_url: p.consent_image_url || null,
  };
  if (created_at) row.created_at = created_at;

  const { data: existing } = await supabaseAdmin
    .from('patients').select('id').eq('clinic_id', CLINIC_ID).eq('hn', hn).maybeSingle();

  if (existing) {
    await supabaseAdmin.from('patients').update(row).eq('id', existing.id);
    return 'updated';
  } else {
    await supabaseAdmin.from('patients').insert(row);
    return 'added';
  }
}

async function upsertVisit(v: any): Promise<'added' | 'updated' | 'skipped'> {
  const hn = v.hn?.trim() || '';
  const price = parseFloat(String(v.price ?? 0).replace(/,/g, '')) || 0;
  if (price <= 0) return 'skipped'; // skip visits ที่ราคา 0

  // หา patient_id
  const { data: patient } = await supabaseAdmin
    .from('patients').select('id').eq('clinic_id', CLINIC_ID).eq('hn', hn).maybeSingle();

  // Parse created_at from Sheet timestamp if provided
  let created_at: string | undefined;
  if (v.created_at || v.timestamp) {
    const raw = v.created_at || v.timestamp;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) created_at = d.toISOString();
  }

  const row: any = {
    clinic_id: CLINIC_ID,
    patient_id: patient?.id || null,
    hn,
    treatment_name: v.treatment_name?.trim() || v.treatment?.trim() || '',
    price: parseFloat(String(v.price ?? 0).replace(/,/g, '')) || 0,
    doctor: v.doctor?.trim() || null,
    sales_name: v.sales_name?.trim() || null,
    customer_type: v.customer_type?.trim() || 'returning',
    payment_method: v.payment_method?.trim() || v.payment?.trim() || 'โอน',
    appt_date: v.appt_date || null,
    appt_time: v.appt_time || null,
  };
  if (created_at) row.created_at = created_at;

  // เช็คซ้ำ: same hn + treatment + price (ป้องกัน duplicate)
  const { data: existing } = await supabaseAdmin
    .from('visits').select('id').eq('clinic_id', CLINIC_ID)
    .eq('hn', hn).eq('treatment_name', row.treatment_name)
    .eq('price', row.price).limit(1);

  if (existing && existing.length > 0) {
    await supabaseAdmin.from('visits').update(row).eq('id', existing[0].id);
    return 'updated';
  } else {
    await supabaseAdmin.from('visits').insert(row);
    return 'added';
  }
}

async function upsertAppointment(v: any): Promise<'added' | 'skipped'> {
  const apptDate = v.appt_date?.trim();
  if (!apptDate) return 'skipped';

  const hn = v.hn?.trim() || '';
  const apptTime = v.appt_time?.trim() || '11:00';
  const name = v.patient_name?.trim() || v.name?.trim() || hn || 'ไม่ระบุ';
  const phone = v.phone?.trim() || '';

  // หา patient_id
  let patientId = null;
  if (hn) {
    const { data: patient } = await supabaseAdmin
      .from('patients').select('id, full_name, phone')
      .eq('clinic_id', CLINIC_ID).eq('hn', hn).maybeSingle();
    if (patient) {
      patientId = patient.id;
    }
  }

  // เช็คซ้ำ: same date + time + hn
  const { data: existing } = await supabaseAdmin
    .from('appointments').select('id')
    .eq('clinic_id', CLINIC_ID)
    .eq('date', apptDate)
    .eq('time', apptTime)
    .eq('hn', hn)
    .limit(1);

  if (existing && existing.length > 0) return 'skipped';

  await supabaseAdmin.from('appointments').insert({
    clinic_id: CLINIC_ID,
    patient_id: patientId,
    hn,
    name,
    phone,
    sales_name: v.sales_name?.trim() || null,
    doctor: v.doctor?.trim() || null,
    status: v.customer_type?.trim()?.toLowerCase() === 'new' ? 'new' : 'returning',
    date: apptDate,
    time: apptTime,
    procedure: v.treatment_name?.trim() || v.appt_treatment?.trim() || null,
  });
  return 'added';
}
