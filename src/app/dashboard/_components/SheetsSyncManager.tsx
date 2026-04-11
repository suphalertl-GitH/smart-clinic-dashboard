'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Sheet, ArrowDownToLine, Copy } from 'lucide-react';

export default function SheetsSyncManager() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const apiUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/sheets-sync`
    : '';

  async function testApi() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/api/sheets-sync?secret=clinic2026secret&type=patients');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ ok: true, count: data.patients?.length ?? 0 });
    } catch (err: any) {
      setResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  function copyScript() {
    const script = `// === Google Apps Script: ส่งข้อมูลไป Smart Clinic Supabase ===
// วาง URL ของ API และ Secret Key
var API_URL = "${apiUrl}";
var SECRET = "clinic2026secret";

function sendBatch(items, key) {
  var BATCH = 50;
  var total = { added: 0, updated: 0 };
  for (var b = 0; b < items.length; b += BATCH) {
    var chunk = items.slice(b, b + BATCH);
    var payload = { secret: SECRET, type: "bulk", data: {} };
    payload.data[key] = chunk;
    var res = UrlFetchApp.fetch(API_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify(payload)
    });
    var r = JSON.parse(res.getContentText());
    if (r.stats && r.stats[key]) {
      total.added += r.stats[key].added || 0;
      total.updated += r.stats[key].updated || 0;
    }
  }
  return total;
}

// ส่งข้อมูลคนไข้ทั้งหมด
function syncPatients() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PatientDataGAS");
  var data = sheet.getDataRange().getValues();
  var patients = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[1]) continue;
    var p = {
      hn: String(row[1]).trim(),
      full_name: String(row[2]).trim(),
      phone: String(row[3]).trim(),
      allergies: String(row[4] || "").trim(),
      disease: String(row[5] || "").trim(),
      face_image_url: String(row[6] || ""),
      source: String(row[7] || "").trim(),
      sales_name: String(row[8] || "").trim(),
      consent_image_url: String(row[9] || "")
    };
    if (row[0]) p.timestamp = new Date(row[0]).toISOString();
    patients.push(p);
  }

  var res = UrlFetchApp.fetch(API_URL, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify({ secret: SECRET, type: "bulk", data: { patients: patients } })
  });
  SpreadsheetApp.getUi().alert("Sync patients สำเร็จ!\\n" + res.getContentText());
}

// ส่งข้อมูล Visit ทั้งหมด
function syncVisits() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("VisitData");
  var data = sheet.getDataRange().getValues();
  var visits = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[2]) continue;
    var visit = {
      hn: row[0] ? String(row[0]).trim() : "WALK-IN",
      sales_name: String(row[1] || "").trim(),
      price: Number(row[2]) || 0,
      treatment_name: String(row[5] || "").trim(),
      doctor: String(row[6] || "").trim(),
      customer_type: String(row[7] || "returning").trim(),
      payment_method: String(row[8] || "โอน").trim(),
      appt_date: row[9] ? String(row[9]).trim() : null,
      appt_time: row[10] ? String(row[10]).trim() : null
    };
    if (row[4]) visit.timestamp = new Date(row[4]).toISOString();
    visits.push(visit);
  }

  var r = sendBatch(visits, "visits");
  SpreadsheetApp.getUi().alert("Sync visits สำเร็จ! added:" + r.added + " updated:" + r.updated);
}

// ส่งทั้ง patients + visits
function syncAll() {
  syncPatients();
  syncVisits();
}

// เพิ่มเมนูใน Google Sheets
function onOpen() {
  SpreadsheetApp.getUi().createMenu("🔄 Sync to Supabase")
    .addItem("Sync Patients", "syncPatients")
    .addItem("Sync Visits", "syncVisits")
    .addSeparator()
    .addItem("Sync All", "syncAll")
    .addToUi();
}`;

    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Connection Test */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Sheet size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Google Sheets → Supabase</h3>
              <p className="text-xs text-slate-400">ใช้ Google Apps Script ส่งข้อมูลจาก Sheet เข้า Supabase</p>
            </div>
          </div>
          <button
            onClick={testApi}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
            ทดสอบ API
          </button>
        </div>

        {result && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {result.ok ? (
              <>
                <CheckCircle2 size={16} />
                <span>API ทำงานปกติ — มี {result.count} patients ใน Supabase</span>
              </>
            ) : (
              <>
                <XCircle size={16} />
                <span>Error: {result.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Setup Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">วิธีตั้งค่า Google Apps Script</h3>
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="font-bold text-slate-800 shrink-0">1.</span>
            <span>เปิด Google Sheet → เมนู <strong>Extensions → Apps Script</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-slate-800 shrink-0">2.</span>
            <span>ลบโค้ดเก่าทั้งหมด แล้ววาง script ด้านล่าง</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-slate-800 shrink-0">3.</span>
            <span>กด <strong>Save</strong> → รีเฟรช Google Sheet → จะเห็นเมนู <strong>"🔄 Sync to Supabase"</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-slate-800 shrink-0">4.</span>
            <span>กด <strong>Sync All</strong> เพื่อส่งข้อมูลทั้งหมดเข้า Supabase</span>
          </li>
        </ol>

        <button
          onClick={copyScript}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
        >
          <Copy size={14} />
          {copied ? 'คัดลอกแล้ว!' : 'คัดลอก Apps Script'}
        </button>
      </div>

      {/* API Info */}
      <div className="bg-slate-50 rounded-2xl p-5 text-xs text-slate-500 space-y-2">
        <p className="font-semibold text-slate-600">API Endpoint:</p>
        <code className="block bg-white p-2 rounded-lg text-slate-700 break-all">{apiUrl || '/api/sheets-sync'}</code>
        <p className="mt-2">POST: ส่งข้อมูล patient/visit เข้า Supabase | GET: ดึงข้อมูลจาก Supabase</p>
      </div>
    </div>
  );
}
