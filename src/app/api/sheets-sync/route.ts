import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSheetData, clearAndWriteSheet, testConnection } from '@/lib/google-sheets';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// ── Column mapping ─────────────────────────────────────────
// PatientDataGAS headers: Timestamp(A), HN(B), ชื่อ-นามสกุล(C), เบอร์โทรศัพท์(D),
//   ประวัติแพ้ยา(E), โรคประจำตัว(F), อัปโหลดรูปใบหน้า(G), Source(H), Sales_Name(I), Consent(URL)(J)

function sheetRowToPatient(row: string[]) {
  return {
    clinic_id: CLINIC_ID,
    hn: row[1]?.trim() || '',
    full_name: row[2]?.trim() || '',
    phone: row[3]?.trim() || '',
    allergies: row[4]?.trim() || null,
    disease: row[5]?.trim() || null,
    face_image_url: row[6]?.trim() || null,
    source: row[7]?.trim() || null,
    sales_name: row[8]?.trim() || null,
    consent_image_url: row[9]?.trim() || null,
  };
}

function patientToSheetRow(p: any): string[] {
  return [
    p.created_at ? new Date(p.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '',
    p.hn || '',
    p.full_name || '',
    p.phone || '',
    p.allergies || '',
    p.disease || '',
    p.face_image_url || '',
    p.source || '',
    p.sales_name || '',
    p.consent_image_url || '',
  ];
}

// VisitData headers: HN(A), Sales_name(B), ราคา(C), ยอดรวม(D), Timestamp(E),
//   Treatment_Item(F), ชื่อแพทย์(G), Customer_Type(H), Payment(I),
//   วันที่นัดหมาย(J), เวลานัดหมาย(K), ชื่อ(L), เบอร์โทร(M), หลักการทั่วไป(N), Note(O)

function sheetRowToVisit(row: string[]) {
  const price = parseFloat(row[2]?.replace(/,/g, '') || '0') || 0;
  return {
    clinic_id: CLINIC_ID,
    hn: row[0]?.trim() || '',
    sales_name: row[1]?.trim() || null,
    price,
    treatment_name: row[5]?.trim() || '',
    doctor: row[6]?.trim() || null,
    customer_type: row[7]?.trim() || 'returning',
    payment_method: row[8]?.trim() || 'โอน',
    appt_date: row[9]?.trim() || null,
    appt_time: row[10]?.trim() || null,
  };
}

function visitToSheetRow(v: any): string[] {
  return [
    v.hn || '',
    v.sales_name || '',
    v.price?.toString() || '0',
    v.price?.toString() || '0',
    v.created_at ? new Date(v.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '',
    v.treatment_name || '',
    v.doctor || '',
    v.customer_type || 'returning',
    v.payment_method || 'โอน',
    v.appt_date || '',
    v.appt_time || '',
    '', // ชื่อ (denormalized, skip)
    '', // เบอร์โทร (denormalized, skip)
    '', // หลักการทั่วไป
    '', // Note
  ];
}

// ── Sync: Sheets → Supabase ────────────────────────────────
async function sheetsToSupabase() {
  const stats = { patients: { added: 0, updated: 0, skipped: 0 }, visits: { added: 0, updated: 0, skipped: 0 } };

  // 1. Sync patients
  const patientRows = await getSheetData('PatientDataGAS!A2:J');
  for (const row of patientRows) {
    const p = sheetRowToPatient(row);
    if (!p.hn) { stats.patients.skipped++; continue; }

    const { data: existing } = await supabaseAdmin
      .from('patients').select('id').eq('clinic_id', CLINIC_ID).eq('hn', p.hn).maybeSingle();

    if (existing) {
      await supabaseAdmin.from('patients').update(p).eq('id', existing.id);
      stats.patients.updated++;
    } else {
      await supabaseAdmin.from('patients').insert(p);
      stats.patients.added++;
    }
  }

  // 2. Sync visits
  const visitRows = await getSheetData('VisitData!A2:O');
  for (const row of visitRows) {
    const v = sheetRowToVisit(row);
    if (!v.hn || !v.treatment_name) { stats.visits.skipped++; continue; }

    // Find patient_id by hn
    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('clinic_id', CLINIC_ID).eq('hn', v.hn).maybeSingle();

    const visitData = { ...v, patient_id: patient?.id || null };

    // Check if visit already exists (same hn + treatment + date)
    const timestamp = row[4]?.trim();
    let existing = null;
    if (timestamp) {
      const { data } = await supabaseAdmin
        .from('visits').select('id').eq('clinic_id', CLINIC_ID).eq('hn', v.hn)
        .eq('treatment_name', v.treatment_name).limit(1);
      // Simple dedup: if same hn + treatment exists, update the latest
      if (data && data.length > 0) existing = data[0];
    }

    if (existing) {
      await supabaseAdmin.from('visits').update(visitData).eq('id', existing.id);
      stats.visits.updated++;
    } else {
      await supabaseAdmin.from('visits').insert(visitData);
      stats.visits.added++;
    }
  }

  return stats;
}

// ── Sync: Supabase → Sheets ────────────────────────────────
async function supabaseToSheets() {
  const stats = { patients: { written: 0 }, visits: { written: 0 } };

  // 1. Export patients
  const { data: patients } = await supabaseAdmin
    .from('patients').select('*').eq('clinic_id', CLINIC_ID).order('hn');
  const patientRows = (patients ?? []).map(patientToSheetRow);
  await clearAndWriteSheet('PatientDataGAS!A2:J', patientRows);
  stats.patients.written = patientRows.length;

  // 2. Export visits
  const { data: visits } = await supabaseAdmin
    .from('visits').select('*').eq('clinic_id', CLINIC_ID).order('created_at', { ascending: false });
  const visitRows = (visits ?? []).map(visitToSheetRow);
  await clearAndWriteSheet('VisitData!A2:O', visitRows);
  stats.visits.written = visitRows.length;

  return stats;
}

// ── Sync: Two-way ──────────────────────────────────────────
async function twoWaySync() {
  // Step 1: Sheets → Supabase (import new data from sheets)
  const importStats = await sheetsToSupabase();

  // Step 2: Supabase → Sheets (export all data back to sheets, now including any Supabase-only data)
  const exportStats = await supabaseToSheets();

  return { import: importStats, export: exportStats };
}

// ── API Handler ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { direction } = await req.json();

    if (direction === 'test') {
      const result = await testConnection();
      return NextResponse.json(result);
    }

    if (direction === 'sheets-to-supabase') {
      const stats = await sheetsToSupabase();
      return NextResponse.json({ success: true, direction, stats });
    }

    if (direction === 'supabase-to-sheets') {
      const stats = await supabaseToSheets();
      return NextResponse.json({ success: true, direction, stats });
    }

    if (direction === 'two-way') {
      const stats = await twoWaySync();
      return NextResponse.json({ success: true, direction, stats });
    }

    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
  } catch (err: any) {
    console.error('Sheets sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
