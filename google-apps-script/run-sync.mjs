/**
 * Smart Clinic — Google Sheets → Supabase Sync
 * รัน: node google-apps-script/run-sync.mjs
 *
 * Incremental logic:
 *   - ครั้งแรก (ไม่มี .sync-state.json): ดึงทุกแถว
 *   - ครั้งต่อไป: ดึงเฉพาะแถวที่ Timestamp (col E/A) ตรงกับวันที่วันนี้
 *
 * Patients  ← tab PatientDataGAS  col A=Timestamp, B=HN, C=ชื่อ-นามสกุล,
 *             D=เบอร์โทร, E=ประวัติแพ้ยา, F=โรคประจำตัว, G=รูปใบหน้า,
 *             H=Source, I=Sales_Name, J=Consent (URL)
 *
 * Visits    ← tab VisitData  col A=HN, B=Sales_name, C=ราคา, D=ยอดรวม,
 *             E=Timestamp, F=Treatment_Name, I=Payment_Method, L=ชื่อ, M=เบอร์โทร
 *             filter: ยอดรวม > 0
 *
 * Appointments ← tab VisitData  col A=HN, B=Sales_name, H=Customer_Type,
 *             J=วันที่นัดหมาย, K=เวลานัดหมาย, L=ชื่อ, M=เบอร์โทร,
 *             N=หัตถการที่นัด, O=Note, P=ผลการติดตาม, Q=สถานะการติดตาม
 *             filter: J (วันที่นัดหมาย) ไม่ว่าง
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const SHEET_ID  = '1OAMPO528LmZZb2x389-RweCGtdRHLsfu_t9csfzdjPw';
const GID_PAT   = '0';           // PatientDataGAS
const GID_VISIT = '765833505';   // VisitData
const API_URL   = 'https://smart-clinic-cyan.vercel.app/api/sheets-sync';
const SECRET    = 'clinic2026secret';
const STATE_FILE = 'google-apps-script/.sync-state.json';
const BATCH_PAT = 500;

// ─── State (incremental) ──────────────────────────────────────
function loadState() {
  if (!existsSync(STATE_FILE)) return { lastSync: null };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return { lastSync: null }; }
}
function saveState(date) {
  writeFileSync(STATE_FILE, JSON.stringify({ lastSync: date }), 'utf8');
}

// วันนี้ในรูปแบบ D/M/YYYY (ตรงกับ Google Sheets Thai locale) เช่น 12/4/2026
function todayThai() {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// เทียบ timestamp ว่าตรงวันที่ที่ต้องการ (รับ "12/4/2026" หรือ "2026-04-12" ก็ได้)
function matchDate(tsStr, targetThai) {
  if (!tsStr) return false;
  const s = String(tsStr).trim();
  // รูปแบบ D/M/YYYY หรือ DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}` === targetThai;
  // รูปแบบ YYYY-MM-DD
  const iso = s.slice(0, 10);
  const [y, mo, day] = iso.split('-');
  if (y && mo && day) return `${parseInt(day)}/${parseInt(mo)}/${y}` === targetThai;
  return false;
}

// ─── CSV Parser ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const headers = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    rows.push(obj);
  }
  return { headers, rows };
}

function splitLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────
const s = v => { const t = String(v ?? '').trim(); return t || null; };
const price = v => parseFloat(String(v || '0').replace(/,/g, '')) || 0;

function parseThaiDate(v) {
  if (!v) return null;
  const str = String(v).trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return null;
}

// ─── Fetch helpers ────────────────────────────────────────────
async function fetchCSV(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

async function postAPI(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, ...payload }),
  });
  return res.json();
}

// ─── Readers ──────────────────────────────────────────────────
/**
 * PatientDataGAS:
 * A=Timestamp, B=HN, C=ชื่อ-นามสกุล, D=เบอร์โทรศัพท์,
 * E=ประวัติแพ้ยา, F=โรคประจำตัว, G=อัปโหลดรูปใบหน้า,
 * H=Source, I=Sales_Name, J=Consent (URL)
 */
function readPatients(rows, incremental, today) {
  return rows
    .filter(r => {
      const hn = String(r['HN'] || '').trim();
      if (!hn || /^\d{1,2}:\d{2}/.test(hn)) return false;   // กรอง HN ที่เป็น timestamp
      if (incremental) return matchDate(r['Timestamp'], today);
      return true;
    })
    .map(r => ({
      hn:                String(r['HN']).trim(),
      full_name:         String(r['ชื่อ-นามสกุล'] || '').trim(),
      phone:             s(r['เบอร์โทรศัพท์']),
      allergies:         s(r['ประวัติแพ้ยา']),
      disease:           s(r['โรคประจำตัว']),
      face_image_url:    s(r['อัปโหลดรูปใบหน้า']),
      source:            s(r['Source']),
      sales_name:        s(r['Sales_Name']),
      consent_image_url: s(r['Consent (URL)']),
    }));
}

/**
 * VisitData → Visits:
 * A=HN, B=Sales_name, C=ราคา, D=ยอดรวม, E=Timestamp,
 * F=Treatment_Name, I=Payment_Method, L=ชื่อ, M=เบอร์โทร
 * filter: ยอดรวม (D) > 0
 */
function readVisits(rows, incremental, today) {
  return rows
    .filter(r => {
      const p = price(r['ยอดรวม'] || r['ราคา']);
      if (p <= 0) return false;
      if (incremental) return matchDate(r['Timestamp'], today);
      return true;
    })
    .map(r => ({
      hn:             String(r['HN'] || '').trim(),
      sales_name:     s(r['Sales_name']),
      price:          price(r['ยอดรวม'] || r['ราคา']),
      treatment_name: String(r['Treatment_Name'] || '').trim(),
      doctor:         s(r['ชื่อแพทย์ที่ให้บริการ']),
      payment_method: s(r['Payment_Method']) || 'โอน',
      name:           s(r['ชื่อ']),
      phone:          s(r['เบอร์โทร']),
      timestamp:      parseThaiDate(r['Timestamp']),
    }));
}

/**
 * VisitData → Appointments:
 * A=HN, B=Sales_name, H=Customer_Type, J=วันที่นัดหมาย,
 * K=เวลานัดหมาย, L=ชื่อ, M=เบอร์โทร, N=หัตถการที่นัด,
 * O=Note, P=ผลการติดตาม, Q=สถานะการติดตาม
 * filter: J (วันที่นัดหมาย) ไม่ว่าง
 */
function readAppointments(rows, incremental, today) {
  return rows
    .filter(r => {
      const apptDate = r['วันที่นัดหมาย (Appointment_Date)'];
      if (!apptDate || !String(apptDate).trim()) return false;
      if (incremental) return matchDate(r['Timestamp'], today);
      return true;
    })
    .map(r => ({
      hn:            String(r['HN'] || '').trim(),
      sales_name:    s(r['Sales_name']),
      customer_type: s(r['Customer_Type']),
      appt_date:     parseThaiDate(r['วันที่นัดหมาย (Appointment_Date)']),
      appt_time:     s(r['เวลานัดหมาย (Appointment_Time)']),
      name:          s(r['ชื่อ']),
      phone:         s(r['เบอร์โทร']),
      appt_treatment:s(r['หัตถการที่นัด']),
      note:          s(r['Note']),
      follow_result: s(r['ผลการติดตาม']),
      follow_status: s(r['สถานะติดตาม']),
    }));
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  const state = loadState();
  const today = todayThai();
  const incremental = state.lastSync !== null;

  console.log(incremental
    ? `🔄 Incremental sync — เฉพาะวันที่ ${today}`
    : `🚀 Full sync — ดึงทุกแถว`);

  const [patCSV, visCSV] = await Promise.all([fetchCSV(GID_PAT), fetchCSV(GID_VISIT)]);

  const { rows: patRows } = parseCSV(patCSV);
  const { rows: visRows } = parseCSV(visCSV);

  const patients     = readPatients(patRows, incremental, today);
  const visits       = readVisits(visRows, incremental, today);
  const appointments = readAppointments(visRows, incremental, today);

  console.log(`  Patients: ${patients.length} | Visits: ${visits.length} | Appointments: ${appointments.length}`);

  // ── ส่ง Patients เป็น batch ──
  if (patients.length > 0) {
    const total = Math.ceil(patients.length / BATCH_PAT);
    for (let b = 0; b < total; b++) {
      const chunk = patients.slice(b * BATCH_PAT, (b + 1) * BATCH_PAT);
      process.stdout.write(`  Patients batch ${b+1}/${total} (${chunk.length})... `);
      const r = await postAPI({ type: 'bulk', data: { patients: chunk, visits: [], appointments: [] } });
      console.log(r.stats ? `✅ updated=${r.stats.patients.updated}` : `❌ ${JSON.stringify(r)}`);
    }
  }

  // ── ส่ง Visits ──
  if (visits.length > 0) {
    process.stdout.write(`  Visits (${visits.length})... `);
    const r = await postAPI({ type: 'bulk', data: { patients: [], visits, appointments: [] } });
    if (r.stats) {
      console.log(`✅ added=${r.stats.visits.added} updated=${r.stats.visits.updated}`);
    } else {
      console.log(`❌ ${JSON.stringify(r)}`);
    }
  }

  // ── ส่ง Appointments ──
  if (appointments.length > 0) {
    process.stdout.write(`  Appointments (${appointments.length})... `);
    const r = await postAPI({ type: 'bulk', data: { patients: [], visits: [], appointments } });
    if (r.stats) {
      const a = r.stats.appointments;
      console.log(`✅ added=${a.added} updated=${a.updated} skipped=${a.skipped}`);
    } else {
      console.log(`❌ ${JSON.stringify(r)}`);
    }
  }

  saveState(today);
  console.log(`\n✅ Sync เสร็จ — บันทึก state: ${today}`);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
