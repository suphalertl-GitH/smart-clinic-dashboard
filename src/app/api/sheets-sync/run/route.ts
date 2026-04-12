import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const SHEET_ID  = '1OAMPO528LmZZb2x389-RweCGtdRHLsfu_t9csfzdjPw';
const GID_PAT   = '0';
const GID_VISIT = '765833505';
const BATCH     = 500;

// ─── CSV Parser ───────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  const headers = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

function splitLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

const s = (v: any) => { const t = String(v ?? '').trim(); return t || null; };
const price = (v: any) => parseFloat(String(v || '0').replace(/,/g, '')) || 0;
const normalizePayment = (v: string | null): string => {
  if (!v) return 'โอน';
  const l = v.toLowerCase();
  if (l.includes('เงินสด') || l.includes('cash')) return 'เงินสด';
  if (l.includes('เครดิต') || l.includes('credit') || l.includes('card')) return 'เครดิต';
  return 'โอน';
};

function parseThaiDate(v: any): string | null {
  if (!v) return null;
  const str = String(v).trim();
  // ลบ $ ออก เพื่อรองรับ timestamp ที่มีเวลาต่อท้าย เช่น "11/4/2026, 13:45"
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return null;
}

// วันนี้ในรูปแบบ D/M/YYYY (ตรงกับ Google Sheets Thai locale) เช่น 12/4/2026
function todayThai(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// เทียบ timestamp ว่าตรงวันที่ที่ต้องการ
function matchDate(tsStr: string | undefined, targetThai: string): boolean {
  if (!tsStr) return false;
  const s2 = String(tsStr).trim();
  const m = s2.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}` === targetThai;
  const iso = s2.slice(0, 10);
  const [y, mo, day] = iso.split('-');
  if (y && mo && day) return `${parseInt(day)}/${parseInt(mo)}/${y}` === targetThai;
  return false;
}

// ─── Fetch CSV from Google Sheets ────────────────────────────
async function fetchCSV(gid: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

// ─── Sync functions ───────────────────────────────────────────
async function syncPatients(patRows: Record<string, string>[], filterToday?: string) {
  const patients = patRows
    .filter(r => {
      const hn = String(r['HN'] || '').trim();
      if (!hn || /^\d{1,2}:\d{2}/.test(hn)) return false;
      if (filterToday) return matchDate(r['Timestamp'], filterToday);
      return true;
    })
    .map(r => ({
      hn:                String(r['HN'] || '').trim(),
      full_name:         String(r['ชื่อ-นามสกุล'] || '').trim(),
      phone:             s(r['เบอร์โทรศัพท์']),
      allergies:         s(r['ประวัติแพ้ยา']),
      disease:           s(r['โรคประจำตัว']),
      face_image_url:    s(r['อัปโหลดรูปใบหน้า']),
      source:            s(r['Source']),
      sales_name:        s(r['Sales_Name']),
      consent_image_url: s(r['Consent (URL)']),
    }))
    .filter(p => p.hn);

  let updated = 0;
  for (let b = 0; b < patients.length; b += BATCH) {
    const chunk = patients.slice(b, b + BATCH).map(p => ({ clinic_id: CLINIC_ID, ...p }));
    const { error } = await supabaseAdmin.from('patients').upsert(chunk, { onConflict: 'clinic_id,hn' });
    if (error) console.error('patient batch error:', error.message);
    else updated += chunk.length;
  }
  return { total: patients.length, updated };
}

async function syncVisits(visRows: Record<string, string>[], filterToday?: string) {
  const visits = visRows.filter(r => {
    if (price(r['ยอดรวม'] || r['ราคา']) <= 0) return false;
    if (filterToday) return matchDate(r['Timestamp'], filterToday);
    return true;
  });
  let added = 0, updated = 0;

  for (const r of visits) {
    const hn = String(r['HN'] || '').trim();
    const treatmentName = String(r['Treatment_Name'] || '').trim();
    const p = price(r['ยอดรวม'] || r['ราคา']);

    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('clinic_id', CLINIC_ID).eq('hn', hn).maybeSingle();

    const visitDate = parseThaiDate(r['Timestamp']);

    // set created_at จากวันที่จริงในชีต (noon Bangkok) เพื่อให้ dashboard groupby เดือนถูกต้อง
    // fallback เป็น now() เสมอ เพื่อไม่ให้ created_at เป็น null แล้วทำให้ dashboard แสดง ฿0
    const createdAt = visitDate
      ? new Date(visitDate + 'T12:00:00+07:00').toISOString()
      : new Date().toISOString();

    // customer_type: เก็บเฉพาะที่ชีตระบุ 'new' ไว้ชัดเจน ที่เหลือเป็น null ก่อน (resolve ตอน upsert)
    const incomingCustomerType = s(r['Customer_Type'])?.toLowerCase() === 'new' ? 'new' : null;

    const visitName = s(r['ชื่อ']) || null;

    const row: any = {
      clinic_id:      CLINIC_ID,
      patient_id:     patient?.id || null,
      hn,
      name:           visitName,
      treatment_name: treatmentName,
      price:          p,
      doctor:         s(r['ชื่อแพทย์ที่ให้บริการ'] || r['ชื่อแพทย์'] || r['Doctor']),
      sales_name:     s(r['Sales_name']),
      payment_method: normalizePayment(s(r['Payment_Method'])),
      customer_type:  incomingCustomerType ?? 'returning',
      visit_date:     visitDate,
      created_at:     createdAt, // always set — never leave as null
    };

    // dedup range สำหรับ created_at (1 วันใน Bangkok = UTC range)
    const dedupStart = visitDate ? new Date(visitDate + 'T00:00:00+07:00').toISOString() : undefined;
    const dedupEnd   = visitDate ? new Date(visitDate + 'T23:59:59+07:00').toISOString() : undefined;

    // dedup query: ถ้า HN ว่าง ใช้ name (ชื่อลูกค้า) แยกแยะแทน
    function buildDedupQuery() {
      let q = supabaseAdmin.from('visits').select('id, customer_type')
        .eq('clinic_id', CLINIC_ID).eq('hn', hn)
        .eq('treatment_name', treatmentName).eq('price', p);
      if (!hn && visitName) q = q.eq('name', visitName);
      if (dedupStart && dedupEnd) q = q.gte('created_at', dedupStart).lte('created_at', dedupEnd);
      return q;
    }

    const { data: existing } = await buildDedupQuery().limit(1);
    if (existing && existing.length > 0) {
      const { created_at: _c, customer_type: _ct, ...updateFields } = row;
      const finalType = incomingCustomerType ?? existing[0].customer_type ?? 'returning';
      await supabaseAdmin.from('visits').update({ ...updateFields, customer_type: finalType }).eq('id', existing[0].id);
      updated++;
    } else {
      const { error } = await supabaseAdmin.from('visits').insert(row);
      if (error) console.error('visit insert error:', error.message, { hn, treatmentName });
      else added++;
    }
  }
  return { total: visits.length, added, updated };
}

async function syncAppointments(visRows: Record<string, string>[], filterToday?: string) {
  const appts = visRows.filter(r => {
    const d = r['วันที่นัดหมาย (Appointment_Date)'] || r['วันที่นัดหมาย'];
    if (!d || !String(d).trim()) return false;
    if (filterToday) return matchDate(r['Timestamp'], filterToday);
    return true;
  });
  let added = 0, updated = 0;

  for (const r of appts) {
    const hn       = String(r['HN'] || '').trim();
    const apptDate = parseThaiDate(r['วันที่นัดหมาย (Appointment_Date)'] || r['วันที่นัดหมาย']);
    if (!apptDate) continue;
    const apptTime = s(r['เวลานัดหมาย (Appointment_Time)'] || r['เวลานัดหมาย']) || '11:00';

    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('clinic_id', CLINIC_ID).eq('hn', hn).maybeSingle();

    const row: any = {
      clinic_id:     CLINIC_ID,
      patient_id:    patient?.id || null,
      hn,
      name:          s(r['ชื่อ']) || hn || 'ไม่ระบุ',
      phone:         s(r['เบอร์โทร']),
      sales_name:    s(r['Sales_name']),
      status:        s(r['Customer_Type'])?.toLowerCase() === 'new' ? 'new' : 'returning',
      date:          apptDate,
      time:          apptTime,
      procedure:     s(r['หัตถการที่นัด'] || r['หัตถการที่นัด (Procedure)']),
      note:          s(r['Note']),
      follow_result: s(r['ผลการติดตาม']),
      follow_status: s(r['สถานะติดตาม'] || r['สถานะการติดตาม']),
    };

    const { data: existing } = await supabaseAdmin
      .from('appointments').select('id')
      .eq('clinic_id', CLINIC_ID).eq('date', apptDate).eq('time', apptTime).eq('hn', hn).limit(1);

    if (existing && existing.length > 0) {
      await supabaseAdmin.from('appointments').update(row).eq('id', existing[0].id);
      updated++;
    } else {
      await supabaseAdmin.from('appointments').insert(row);
      added++;
    }
  }
  return { total: appts.length, added, updated };
}

// ─── Route ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? 'full';   // 'today' | 'full'
    const filterToday = mode === 'today' ? todayThai() : undefined;

    const [patCSV, visCSV] = await Promise.all([fetchCSV(GID_PAT), fetchCSV(GID_VISIT)]);
    const patRows = parseCSV(patCSV);
    const visRows = parseCSV(visCSV);

    const [patients, visits, appointments] = await Promise.all([
      syncPatients(patRows, filterToday),
      syncVisits(visRows, filterToday),
      syncAppointments(visRows, filterToday),
    ]);

    return NextResponse.json({ success: true, mode, filterToday, stats: { patients, visits, appointments } });
  } catch (err: any) {
    console.error('sheets-sync/run error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
