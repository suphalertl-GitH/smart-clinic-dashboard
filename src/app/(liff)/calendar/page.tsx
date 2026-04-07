'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// ============================================================
// Types
// ============================================================
type Appointment = {
  id: string; hn: string | null; name: string; phone: string;
  sales_name: string | null; status: string; date: string;
  time: string; procedure: string | null; note: string | null;
};
type Settings = { sales_names: string[]; doctor_names: string[]; time_slots: string[] };
type Patient = { id: string; hn: string; full_name: string; phone: string; sales_name: string | null };

const DEFAULT_SLOTS = [
  '11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00','18:30','19:00',
];

// ============================================================
// Conflict confirm dialog (ใช้ window.confirm แทน SweetAlert)
// ============================================================
async function confirmOverride(conflictNames: string[]): Promise<string | null> {
  const reason = window.prompt(
    `เวลานี้มีคิวของ "${conflictNames.join(', ')}" อยู่แล้ว\nระบุเหตุผลการแทรกคิว (เช่น มาด้วยกัน, เคสด่วน):`
  );
  return reason?.trim() || null;
}

// ============================================================
// Sub-components
// ============================================================
function AppointmentCard({
  appt, settings, onUpdate, onDelete,
}: {
  appt: Appointment; settings: Settings;
  onUpdate: (id: string, data: Partial<Appointment> & { overrideReason?: string }) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quick reschedule state
  const [newDate, setNewDate] = useState(appt.date);
  const [newTime, setNewTime] = useState(appt.time);

  // Full edit state
  const [fDate, setFDate] = useState(appt.date);
  const [fTime, setFTime] = useState(appt.time);
  const [fHN, setFHN] = useState(appt.hn ?? '');
  const [fName, setFName] = useState(appt.name);
  const [fPhone, setFPhone] = useState(appt.phone);
  const [fSales, setFSales] = useState(appt.sales_name ?? '');
  const [fStatus, setFStatus] = useState(appt.status);
  const [fProc, setFProc] = useState(appt.procedure ?? '');
  const [fNote, setFNote] = useState(appt.note ?? '');

  async function saveReschedule() {
    setSaving(true);
    await onUpdate(appt.id, { date: newDate, time: newTime });
    setSaving(false);
    setShowEdit(false);
  }

  async function saveFullEdit() {
    if (!fDate || !fTime || !fName || !fPhone) { alert('กรุณากรอกข้อมูลสำคัญให้ครบ'); return; }
    setSaving(true);
    await onUpdate(appt.id, { date: fDate, time: fTime, hn: fHN, name: fName, phone: fPhone, sales_name: fSales, status: fStatus as any, procedure: fProc, note: fNote });
    setSaving(false);
    setShowFull(false);
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500 relative">
      <button onClick={() => { setShowFull(!showFull); setShowEdit(false); }} className="absolute top-3 right-3 text-xl">✏️</button>

      <div className="pr-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-base">👤 {appt.name}</span>
          <Badge variant={appt.status === 'new' ? 'default' : 'secondary'} className={appt.status === 'new' ? 'bg-orange-500' : 'bg-blue-500'}>
            {appt.status === 'new' ? 'New' : 'Returning'}
          </Badge>
        </div>
        <p className="text-sm text-gray-500"><span className="font-semibold text-gray-700">HN:</span> {appt.hn ?? '-'} | <span className="font-semibold text-gray-700">เบอร์:</span> {appt.phone}</p>
        <p className="text-sm text-gray-500"><span className="font-semibold text-gray-700">หัตถการ:</span> {appt.procedure ?? '-'}</p>
        <p className="text-sm text-gray-500"><span className="font-semibold text-gray-700">เซลดูแล:</span> {appt.sales_name ?? '-'}</p>
        {appt.note && <p className="text-sm text-red-500 font-semibold mt-1">📝 {appt.note}</p>}
      </div>

      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={() => { setShowEdit(!showEdit); setShowFull(false); }} className="flex-1">⏳ เลื่อนเวลา</Button>
        <Button size="sm" onClick={() => onDelete(appt.id, appt.name)} className="flex-1 bg-red-400 hover:bg-red-500">🗑️ ยกเลิกนัด</Button>
      </div>

      {/* Quick reschedule */}
      {showEdit && (
        <div className="mt-3 p-3 border rounded-lg bg-gray-50 space-y-2">
          <p className="text-sm font-bold">⏳ เลื่อนวันและเวลาใหม่:</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
          </div>
          <Button size="sm" onClick={saveReschedule} disabled={saving} className="w-full bg-green-600">
            {saving ? 'กำลังบันทึก...' : '💾 บันทึกเลื่อนนัด'}
          </Button>
        </div>
      )}

      {/* Full edit */}
      {showFull && (
        <div className="mt-3 p-3 border-t-4 border-blue-500 rounded-lg bg-gray-50 space-y-2">
          <p className="text-sm font-bold">✏️ แก้ไขข้อมูลทั้งหมด:</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
            <Input type="time" value={fTime} onChange={e => setFTime(e.target.value)} />
          </div>
          <Input placeholder="เลข HN" value={fHN} onChange={e => setFHN(e.target.value)} />
          <Input placeholder="ชื่อลูกค้า *" value={fName} onChange={e => setFName(e.target.value)} />
          <Input placeholder="เบอร์โทรศัพท์ *" value={fPhone} onChange={e => setFPhone(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={fSales} onValueChange={v => setFSales(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="เซลล์" /></SelectTrigger>
              <SelectContent>{settings.sales_names.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={v => setFStatus(v ?? 'new')}>
              <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">🆕 New</SelectItem>
                <SelectItem value="returning">🔄 Returning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="หัตถการที่นัด" value={fProc} onChange={e => setFProc(e.target.value)} />
          <textarea value={fNote} onChange={e => setFNote(e.target.value)} placeholder="โน๊ตเพิ่มเติม..." rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <Button size="sm" onClick={saveFullEdit} disabled={saving} className="w-full bg-green-600">
            {saving ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไขทั้งหมด'}
          </Button>
        </div>
      )}
    </div>
  );
}

function AddSlot({
  slot, date, settings, patients, hasBooking, onAdd,
}: {
  slot: string; date: string; settings: Settings; patients: Patient[];
  hasBooking: boolean; onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hnSearch, setHnSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sales, setSales] = useState('');
  const [status, setStatus] = useState('new');
  const [proc, setProc] = useState('');
  const [note, setNote] = useState('');

  function handleHnInput(val: string) {
    setHnSearch(val);
    const found = patients.find(p => p.hn === val.trim());
    if (found) {
      setName(found.full_name);
      setPhone(found.phone);
      setSales(found.sales_name ?? '');
      setStatus('returning');
    }
  }

  async function handleAdd() {
    if (!name.trim() || !phone.trim()) { alert('กรุณากรอกชื่อและเบอร์โทร'); return; }
    if (!sales) { alert('กรุณาเลือกเซลล์'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time: slot, name, hn: hnSearch || null, phone, salesName: sales, status, procedure: proc, note }),
      });
      const data = await res.json();
      if (data.isConflict) {
        const reason = await confirmOverride(data.conflictNames);
        if (!reason) { setSaving(false); return; }
        const res2 = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, time: slot, name, hn: hnSearch || null, phone, salesName: sales, status, procedure: proc, note, overrideReason: reason }),
        });
        const d2 = await res2.json();
        if (d2.error) { alert(d2.error); setSaving(false); return; }
      } else if (data.error) { alert(data.error); setSaving(false); return; }
      setOpen(false); onAdd();
    } finally { setSaving(false); }
  }

  const btnColor = hasBooking ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-dashed border-gray-300 bg-white text-gray-400';

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className={`w-full mt-2 px-4 py-2 border rounded-lg flex justify-between items-center text-sm transition-all ${btnColor}`}>
        <span className="font-bold text-blue-600">{slot} น.</span>
        <span className="font-bold">{hasBooking ? '➕ แทรกคิว' : '➕ เพิ่มคิว'}</span>
      </button>
    );
  }

  return (
    <div className={`mt-2 p-4 border-t-4 rounded-xl space-y-3 ${hasBooking ? 'border-orange-400 bg-orange-50' : 'border-green-500 bg-white'}`}>
      <p className="font-bold text-sm">{hasBooking ? `📝 แทรกคิวเวลา ${slot} น.` : `📝 เพิ่มคิวใหม่เวลา ${slot} น.`}</p>
      <Input placeholder="เลข HN (ถ้ามี ระบบดึงข้อมูลให้อัตโนมัติ)" value={hnSearch} onChange={e => handleHnInput(e.target.value)} />
      <Input placeholder="ชื่อลูกค้า *" value={name} onChange={e => setName(e.target.value)} />
      <Input placeholder="เบอร์โทรศัพท์ *" value={phone} onChange={e => setPhone(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Select value={sales} onValueChange={v => setSales(v ?? '')}>
          <SelectTrigger><SelectValue placeholder="เซลล์ *" /></SelectTrigger>
          <SelectContent>{settings.sales_names.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={v => setStatus(v ?? 'new')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new">🆕 New</SelectItem>
            <SelectItem value="returning">🔄 Returning</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="หัตถการที่นัด (ถ้ามี)" value={proc} onChange={e => setProc(e.target.value)} />
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="โน๊ตเพิ่มเติม..." rows={2}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none" />
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={handleAdd} disabled={saving} className={hasBooking ? 'bg-orange-500' : 'bg-green-600'}>
          {saving ? 'กำลังบันทึก...' : '💾 บันทึกคิว'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>❌ ปิด</Button>
      </div>
    </div>
  );
}

// ============================================================
// Main Calendar Page
// ============================================================
export default function CalendarPage() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<Settings>({ sales_names: [], doctor_names: [], time_slots: DEFAULT_SLOTS });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.ok ? r.json() : {}),
      fetch('/api/patients').then(r => r.ok ? r.json() : []),
    ]).then(([s, p]) => {
      setSettings(s);
      setPatients(Array.isArray(p) ? p : []);
    }).catch(() => {});
  }, []);

  const loadAppointments = useCallback(async (d: string) => {
    setLoadingAppts(true);
    const res = await fetch(`/api/appointments?date=${d}`);
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : []);
    setLoadingAppts(false);
  }, []);

  useEffect(() => { loadAppointments(date); }, [date, loadAppointments]);

  async function handleUpdate(id: string, body: Record<string, any>) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.isConflict) {
      const reason = await confirmOverride(data.conflictNames);
      if (!reason) return;
      await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, overrideReason: reason }),
      });
    }
    if (body.date && body.date !== date) setDate(body.date);
    await loadAppointments(body.date ?? date);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`ยืนยันยกเลิกนัดคุณ ${name}? ลบแล้วกู้คืนไม่ได้`)) return;
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
    await loadAppointments(date);
  }

  const slots = settings.time_slots?.length ? settings.time_slots : DEFAULT_SLOTS;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm text-center">
        <h1 className="font-bold text-lg mb-2">📅 ตารางคิวประจำวัน</h1>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-center text-base max-w-xs mx-auto" />
      </div>

      {loadingAppts ? (
        <div className="text-center text-gray-400 mt-10">🔄 กำลังโหลด...</div>
      ) : (
        <div className="space-y-1">
          {slots.map(slot => {
            const slotAppts = appointments.filter(a => a.time === slot);
            const hasBooking = slotAppts.length > 0;

            return (
              <div key={slot}>
                {hasBooking && (
                  <div className="mt-4">
                    <p className="text-blue-600 font-bold text-sm border-b-2 border-gray-200 pb-1 mb-2">⏰ เวลา {slot} น.</p>
                    <div className="space-y-3">
                      {slotAppts.map(appt => (
                        <AppointmentCard
                          key={appt.id}
                          appt={appt}
                          settings={settings}
                          onUpdate={handleUpdate}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <AddSlot
                  slot={slot}
                  date={date}
                  settings={settings}
                  patients={patients}
                  hasBooking={hasBooking}
                  onAdd={() => loadAppointments(date)}
                />
              </div>
            );
          })}

          {/* นัดนอกสล็อต */}
          {appointments.filter(a => !slots.includes(a.time)).map(appt => (
            <div key={appt.id}>
              <p className="text-orange-500 font-bold text-sm mt-4 border-b-2 border-gray-200 pb-1 mb-2">⏰ เวลา {appt.time} น. (นอกสล็อต)</p>
              <AppointmentCard appt={appt} settings={settings} onUpdate={handleUpdate} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
