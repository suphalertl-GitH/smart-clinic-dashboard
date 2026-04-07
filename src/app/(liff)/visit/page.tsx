'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ============================================================
// Types
// ============================================================
type Patient = { id: string; hn: string; full_name: string; phone: string; sales_name: string | null };
type VisitItem = { name: string; price: number };
type Settings = { sales_names: string[]; doctor_names: string[] };

const TREATMENTS: Record<string, string[]> = {
  Botox: ['Botox Nabota', 'Botox Xeomin', 'Botox Allergan'],
  Filler: ['Filler'],
  'Skin quality': ['Sculptra', 'Profhilo', 'Juvelook', 'Rejuran', 'Meso', 'Treatment'],
  EBD: ['Ultherapy', 'Ultraformer', 'Oligio'],
  Surgery: ['Nose', 'Alar', 'Chin'],
  Other: ['Fat', 'Mounjaro', 'IV', 'Hair'],
};

// ============================================================
// Main Page
// ============================================================
export default function VisitPage() {
  const [settings, setSettings] = useState<Settings>({ sales_names: [], doctor_names: [] });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  // Visit form
  const [treatCategory, setTreatCategory] = useState('');
  const [treatName, setTreatName] = useState('');
  const [price, setPrice] = useState('');
  const [salesName, setSalesName] = useState('');
  const [doctor, setDoctor] = useState('');
  const [payMethod, setPayMethod] = useState('โอน');
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [apptCat, setApptCat] = useState('');
  const [apptTreat, setApptTreat] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [visitId, setVisitId] = useState('');

  // Receipt modal
  const [receiptModal, setReceiptModal] = useState(false);
  const [receiptItems, setReceiptItems] = useState<VisitItem[]>([]);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [receiver, setReceiver] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [genPdf, setGenPdf] = useState(false);

  // Reprint modal
  const [reprintModal, setReprintModal] = useState(false);
  const [rpSearch, setRpSearch] = useState('');
  const [rpDate, setRpDate] = useState('');
  const [rpPatient, setRpPatient] = useState<Patient | null>(null);
  const [rpItems, setRpItems] = useState<VisitItem[]>([]);
  const [rpTotal, setRpTotal] = useState(0);
  const [rpPayment, setRpPayment] = useState('');
  const [rpReceiver, setRpReceiver] = useState('');
  const [rpUrl, setRpUrl] = useState('');
  const [rpError, setRpError] = useState('');
  const [rpSearching, setRpSearching] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/patients').then(r => r.json()),
    ]).then(([s, p]) => {
      setSettings(s);
      setPatients(Array.isArray(p) ? p : []);
      setLoading(false);
    });
  }, []);

  // Filtered patient list for datalist
  const filtered = patients.filter(p =>
    p.hn.toLowerCase().includes(search.toLowerCase()) ||
    p.full_name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50);

  function handleSearchSelect(val: string) {
    setSearch(val);
    const found = patients.find(p => `${p.hn} - ${p.full_name}` === val);
    setSelectedPatient(found ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) { setError('กรุณาเลือกคนไข้จากรายการ'); return; }
    if (!treatName) { setError('กรุณาเลือกหัตถการ'); return; }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hn: selectedPatient.hn,
          fullName: selectedPatient.full_name,
          phone: selectedPatient.phone,
          treatmentName: treatName,
          price,
          salesName,
          doctor,
          customerType: 'returning',
          paymentMethod: payMethod,
          apptDate: apptDate || null,
          apptTime: apptTime || null,
          apptTreatmentName: apptTreat || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setVisitId(data.visit.id);

      // ดึง visit ของวันนี้เพื่อแสดงในใบเสร็จ
      const today = new Date().toISOString().split('T')[0];
      const visitsRes = await fetch(`/api/visits?hn=${selectedPatient.hn}&date=${today}`);
      const visits: VisitItem[] = (await visitsRes.json()).map((v: any) => ({ name: v.treatment_name, price: v.price }));

      setReceiptItems(visits);
      setReceiptTotal(visits.reduce((s, i) => s + Number(i.price), 0));
      setReceiptModal(true);
      setSuccess('บันทึก Visit สำเร็จ');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenPdf() {
    if (!receiver.trim()) { setError('กรุณาใส่ชื่อผู้รับเงิน'); return; }
    setGenPdf(true);
    try {
      const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hn: selectedPatient!.hn,
          fullName: selectedPatient!.full_name,
          items: receiptItems,
          total: receiptTotal,
          payment: payMethod,
          receiver,
          date: today,
          visitId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReceiptUrl(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenPdf(false);
    }
  }

  async function handleReprintSearch() {
    if (!rpPatient || !rpDate) { setRpError('กรุณาเลือกคนไข้และวันที่'); return; }
    setRpSearching(true);
    setRpError('');
    setRpItems([]);
    setRpUrl('');

    try {
      const res = await fetch(`/api/visits?hn=${rpPatient.hn}&date=${rpDate}`);
      const visits = await res.json();
      if (!Array.isArray(visits) || visits.length === 0) {
        setRpError(`ไม่พบรายการของ ${rpPatient.hn} - ${rpPatient.full_name} ในวันที่เลือก`);
        return;
      }
      const items: VisitItem[] = visits.map((v: any) => ({ name: v.treatment_name, price: v.price }));
      setRpItems(items);
      setRpTotal(items.reduce((s, i) => s + Number(i.price), 0));
      setRpPayment(visits[0].payment_method);
    } catch (err: any) {
      setRpError(err.message);
    } finally {
      setRpSearching(false);
    }
  }

  async function handleReprintPdf() {
    if (!rpReceiver.trim()) { setRpError('กรุณาใส่ชื่อผู้รับเงิน'); return; }
    setGenPdf(true);
    try {
      const dateObj = new Date(rpDate);
      const dateStr = dateObj.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hn: rpPatient!.hn,
          fullName: rpPatient!.full_name,
          items: rpItems,
          total: rpTotal,
          payment: rpPayment,
          receiver: rpReceiver,
          date: dateStr,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRpUrl(data.url);
    } catch (err: any) {
      setRpError(err.message);
    } finally {
      setGenPdf(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">กำลังโหลด...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md p-6">
        <h1 className="text-xl font-bold text-center text-green-600 mb-6">บันทึก Visit</h1>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">❌ {error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">✅ {success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ค้นหาคนไข้ */}
          <div>
            <Label>ค้นหาคนไข้ (HN หรือ ชื่อ)</Label>
            <input
              list="patient-list"
              value={search}
              onChange={e => handleSearchSelect(e.target.value)}
              placeholder="พิมพ์เพื่อค้นหา..."
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />
            <datalist id="patient-list">
              {filtered.map(p => <option key={p.id} value={`${p.hn} - ${p.full_name}`} />)}
            </datalist>
            {selectedPatient && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg text-sm border">
                <span className="font-bold text-green-600">HN: {selectedPatient.hn}</span>
                <span className="mx-2 text-gray-400">|</span>
                <span>{selectedPatient.full_name}</span>
              </div>
            )}
          </div>

          {/* หัตถการ */}
          <div>
            <Label>หัตถการวันนี้</Label>
            <Select value={treatCategory} onValueChange={v => { setTreatCategory(v ?? ''); setTreatName(''); }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="-- เลือกกลุ่ม --" /></SelectTrigger>
              <SelectContent>{Object.keys(TREATMENTS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
            {treatCategory && (
              <Select value={treatName} onValueChange={v => setTreatName(v ?? '')}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="-- เลือกรายการ --" /></SelectTrigger>
                <SelectContent>{TREATMENTS[treatCategory].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>

          {/* ราคา */}
          <div>
            <Label>ราคา (บาท)</Label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} required className="mt-1" placeholder="0" />
          </div>

          {/* เซลล์ / หมอ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>เซลล์</Label>
              <Select value={salesName} onValueChange={v => setSalesName(v ?? '')}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="-- เซลล์ --" /></SelectTrigger>
                <SelectContent>{settings.sales_names.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>หมอ</Label>
              <Select value={doctor} onValueChange={v => setDoctor(v ?? '')}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="-- หมอ --" /></SelectTrigger>
                <SelectContent>{settings.doctor_names.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* วิธีชำระ */}
          <div>
            <Label>วิธีชำระเงิน</Label>
            <Select value={payMethod} onValueChange={v => setPayMethod(v ?? 'โอน')}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['โอน', 'เงินสด', 'เครดิต'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* นัดหมายครั้งหน้า */}
          <div>
            <Label>นัดหมายครั้งหน้า (ถ้ามี)</Label>
            <Input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} className="mt-1" />
          </div>

          {apptDate && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl space-y-3">
              <div>
                <Label>เวลานัด</Label>
                <Input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>หัตถการที่นัด</Label>
                <Select value={apptCat} onValueChange={v => { setApptCat(v ?? ''); setApptTreat(''); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="-- เลือกกลุ่ม --" /></SelectTrigger>
                  <SelectContent>{Object.keys(TREATMENTS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
                {apptCat && (
                  <Select value={apptTreat} onValueChange={v => setApptTreat(v ?? '')}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="-- เลือกรายการ --" /></SelectTrigger>
                    <SelectContent>{TREATMENTS[apptCat].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 py-3 text-base">
            {submitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล Visit'}
          </Button>
        </form>

        <hr className="my-6 border-gray-200" />
        <Button variant="outline" className="w-full border-pink-400 text-pink-600 hover:bg-pink-50" onClick={() => setReprintModal(true)}>
          🔍 ค้นหาและออกใบเสร็จย้อนหลัง
        </Button>
      </div>

      {/* ===== Receipt Modal ===== */}
      <Dialog open={receiptModal} onOpenChange={setReceiptModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-green-600">บันทึกสำเร็จ! 🎉</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {receiptItems.map((item, i) => (
              <div key={i} className="flex justify-between border-b border-dashed pb-1">
                <span>{item.name}</span><b>{Number(item.price).toLocaleString()}</b>
              </div>
            ))}
            <div className="flex justify-between font-bold text-red-500 pt-1">
              <span>รวม</span><span>{receiptTotal.toLocaleString()} บาท</span>
            </div>
          </div>

          {!receiptUrl ? (
            <div className="space-y-3 mt-2">
              <div>
                <Label>ชื่อผู้รับเงิน</Label>
                <Input value={receiver} onChange={e => setReceiver(e.target.value)} placeholder="ชื่อพนักงาน" className="mt-1" />
              </div>
              <Button onClick={handleGenPdf} disabled={genPdf} className="w-full bg-pink-600 hover:bg-pink-700">
                {genPdf ? 'กำลังสร้าง...' : 'ออกใบเสร็จ (PDF)'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              <div className="p-3 bg-gray-100 rounded-lg text-xs break-all">{receiptUrl}</div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => navigator.clipboard.writeText(receiptUrl)} className="bg-blue-600">คัดลอกลิงก์</Button>
                <Button size="sm" onClick={() => window.open(receiptUrl)} className="bg-pink-600">เปิดใบเสร็จ</Button>
              </div>
            </div>
          )}
          <Button variant="ghost" className="w-full" onClick={() => { setReceiptModal(false); window.location.reload(); }}>
            ปิด / เริ่มคนใหม่
          </Button>
        </DialogContent>
      </Dialog>

      {/* ===== Reprint Modal ===== */}
      <Dialog open={reprintModal} onOpenChange={setReprintModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-pink-600">ออกใบเสร็จย้อนหลัง</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>เลือกคนไข้</Label>
              <input
                list="rp-patient-list"
                value={rpSearch}
                onChange={e => {
                  setRpSearch(e.target.value);
                  const found = patients.find(p => `${p.hn} - ${p.full_name}` === e.target.value);
                  setRpPatient(found ?? null);
                }}
                placeholder="พิมพ์ชื่อ หรือ HN..."
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              <datalist id="rp-patient-list">
                {patients.slice(0, 50).map(p => <option key={p.id} value={`${p.hn} - ${p.full_name}`} />)}
              </datalist>
            </div>
            <div>
              <Label>วันที่รับบริการ</Label>
              <Input type="date" value={rpDate} onChange={e => setRpDate(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleReprintSearch} disabled={rpSearching} className="w-full bg-pink-600 hover:bg-pink-700">
              {rpSearching ? 'กำลังค้นหา...' : 'ค้นหารายการ'}
            </Button>
            {rpError && <p className="text-red-500 text-sm text-center">{rpError}</p>}

            {rpItems.length > 0 && !rpUrl && (
              <div className="space-y-2">
                {rpItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm border-b pb-1">
                    <span>{item.name}</span><b>{Number(item.price).toLocaleString()}</b>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-red-500">
                  <span>รวม</span><span>{rpTotal.toLocaleString()} บาท</span>
                </div>
                <div>
                  <Label>ผู้รับเงิน</Label>
                  <Input value={rpReceiver} onChange={e => setRpReceiver(e.target.value)} placeholder="ชื่อพนักงาน" className="mt-1" />
                </div>
                <Button onClick={handleReprintPdf} disabled={genPdf} className="w-full bg-pink-600">
                  {genPdf ? 'กำลังสร้าง...' : 'สร้างใบเสร็จ (PDF)'}
                </Button>
              </div>
            )}

            {rpUrl && (
              <div className="space-y-2">
                <div className="p-3 bg-gray-100 rounded-lg text-xs break-all">{rpUrl}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => navigator.clipboard.writeText(rpUrl)} className="bg-blue-600">คัดลอกลิงก์</Button>
                  <Button size="sm" onClick={() => window.open(rpUrl)} className="bg-pink-600">เปิดใบเสร็จ</Button>
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setReprintModal(false)}>ปิด</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
