/**
 * Smart Clinic — Google Sheets → Supabase Sync
 * วิธีใช้: Extensions > Apps Script > วาง code นี้ > Save > Run syncAll
 *
 * PatientDataGAS columns:
 *   A=Timestamp, B=HN, C=ชื่อ-นามสกุล, D=เบอร์โทรศัพท์,
 *   E=ประวัติแพ้ยา, F=โรคประจำตัว, G=อัปโหลดรูปใบหน้า,
 *   H=Source, I=Sales_Name, J=Consent (URL)
 *
 * VisitData columns:
 *   A=HN, B=Sales_name, C=ราคา, D=ยอดรวม, E=Timestamp,
 *   F=Treatment, G=ชื่อพนักงาน(แพทย์), H=Customer_Type,
 *   I=Payment, J=วันที่นัดหมาย, K=เวลานัดหมาย,
 *   L=ชื่อ, M=เบอร์โทร
 */

var API_URL = 'https://smart-clinic-cyan.vercel.app/api/sheets-sync';
var SECRET  = 'clinic2026secret';

// ─── Entry Points ───────────────────────────────────────────

/** Sync ทุกอย่างครั้งเดียว (รัน manual หรือ trigger) */
function syncAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var patients = readPatients(ss);
  var visits   = readVisits(ss);

  Logger.log('Patients: ' + patients.length + ', Visits: ' + visits.length);

  var result = postToAPI({ type: 'bulk', data: { patients: patients, visits: visits } });
  Logger.log('Result: ' + JSON.stringify(result));
  showToast(ss, result);
}

/** Sync เฉพาะ Patients */
function syncPatients() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var patients = readPatients(ss);
  Logger.log('Patients: ' + patients.length);
  var result = postToAPI({ type: 'bulk', data: { patients: patients, visits: [] } });
  Logger.log('Result: ' + JSON.stringify(result));
  showToast(ss, result);
}

/** Sync เฉพาะ Visits */
function syncVisits() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var visits = readVisits(ss);
  Logger.log('Visits: ' + visits.length);
  var result = postToAPI({ type: 'bulk', data: { patients: [], visits: visits } });
  Logger.log('Result: ' + JSON.stringify(result));
  showToast(ss, result);
}

// ─── Readers ────────────────────────────────────────────────

function readPatients(ss) {
  var sheet = ss.getSheetByName('PatientDataGAS');
  if (!sheet) { Logger.log('ERROR: ไม่พบ tab PatientDataGAS'); return []; }

  var rows = sheet.getDataRange().getValues();
  var patients = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var hn = String(row[1] || '').trim();
    if (!hn || hn.toLowerCase() === 'hn') continue; // skip header / empty

    // Parse Timestamp (col A)
    var created_at = parseDate(row[0]);

    patients.push({
      hn:               hn,
      full_name:        String(row[2] || '').trim(),
      phone:            String(row[3] || '').trim(),
      allergies:        strOrNull(row[4]),
      disease:          strOrNull(row[5]),
      face_image_url:   strOrNull(row[6]),
      source:           strOrNull(row[7]),
      sales_name:       strOrNull(row[8]),
      consent_image_url:strOrNull(row[9]),
      created_at:       created_at
    });
  }

  return patients;
}

function readVisits(ss) {
  var sheet = ss.getSheetByName('VisitData');
  if (!sheet) { Logger.log('ERROR: ไม่พบ tab VisitData'); return []; }

  var rows = sheet.getDataRange().getValues();
  var visits = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var hn = String(row[0] || '').trim();
    if (!hn) continue;

    // ใช้ ยอดรวม (col D) ก่อน ถ้าว่างใช้ ราคา (col C)
    var price = parseFloat(String(row[3] || row[2] || '0').replace(/,/g, '')) || 0;
    if (price <= 0) continue; // skip แถวที่ไม่มีราคา

    // Timestamp (col E)
    var created_at = parseDate(row[4]);

    // Appointment Date (col J) — format yyyy-MM-dd
    var appt_date = formatDate(row[9]);

    // Appointment Time (col K) — format HH:mm
    var appt_time = formatTime(row[10]);

    visits.push({
      hn:             hn,
      sales_name:     strOrNull(row[1]),
      price:          price,
      created_at:     created_at,
      treatment_name: String(row[5] || '').trim(),
      doctor:         strOrNull(row[6]),   // ชื่อพนักงาน = แพทย์/พนักงาน
      customer_type:  strOrNull(row[7]) || 'returning',
      payment_method: strOrNull(row[8]) || 'โอน',
      appt_date:      appt_date,
      appt_time:      appt_time,
      name:           strOrNull(row[11]), // ชื่อ (col L)
      phone:          strOrNull(row[12])  // เบอร์โทร (col M)
    });
  }

  return visits;
}

// ─── API Call ───────────────────────────────────────────────

function postToAPI(payload) {
  payload.secret = SECRET;
  var options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(API_URL, options);
    var code = response.getResponseCode();
    if (code !== 200) {
      return { error: 'HTTP ' + code, body: response.getContentText() };
    }
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { error: e.toString() };
  }
}

// ─── Helpers ────────────────────────────────────────────────

function strOrNull(val) {
  var s = String(val || '').trim();
  return s ? s : null;
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
  }
  var s = String(val).trim();
  return s || null;
}

function formatTime(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'HH:mm');
  }
  var s = String(val).trim();
  return s || null;
}

function showToast(ss, result) {
  if (result && result.stats) {
    var s = result.stats;
    var msg = 'Sync สำเร็จ!\n' +
      'Patients: +' + (s.patients.added||0) + ' updated=' + (s.patients.updated||0) + '\n' +
      'Visits: +' + (s.visits.added||0) + ' updated=' + (s.visits.updated||0);
    ss.toast(msg, 'Sync to Supabase', 8);
  } else if (result && result.error) {
    ss.toast('Error: ' + result.error, 'Sync Failed', 10);
  }
}

// ─── Auto Trigger ───────────────────────────────────────────

/**
 * รัน createDailyTrigger() ครั้งเดียวเพื่อตั้ง auto-sync ทุกวันเวลา 02:00
 */
function createDailyTrigger() {
  // ลบ trigger เก่าก่อน
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  Logger.log('Created daily trigger: syncAll @ 02:00');
}
