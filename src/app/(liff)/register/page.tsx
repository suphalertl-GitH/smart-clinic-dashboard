'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type InitialData = { hn: string; sales: string[]; };

export default function RegisterPage() {
  const [initialData, setInitialData] = useState<InitialData>({ hn: '', sales: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [allergies, setAllergies] = useState('');
  const [disease, setDisease] = useState('');
  const [source, setSource] = useState('Facebook');
  const [salesName, setSalesName] = useState('');
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch('/api/patients/next-hn').then(r => r.ok ? r.json() : { hn: 'HN00001' }),
      fetch('/api/settings').then(r => r.ok ? r.json() : { sales_names: [] }),
    ]).then(([hnData, settings]) => {
      setInitialData({ hn: hnData.hn ?? 'HN00001', sales: settings.sales_names ?? [] });
      setLoading(false);
    }).catch(() => setLoading(false));

    initCanvas();
  }, []);

  // Signature pad
  function initCanvas() {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 340;
      canvas.height = 180;
      const ctx = canvas.getContext('2d')!;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
    }, 100);
  }

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw() { isDrawingRef.current = false; }

  function clearSignature() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  }

  function isCanvasEmpty() {
    const canvas = canvasRef.current!;
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() === blank.toDataURL();
  }

  async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = e => {
        const img = new Image();
        img.src = e.target!.result as string;
        img.onload = () => {
          const cvs = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > 800) { h = Math.round(h * 800 / w); w = 800; }
          cvs.width = w; cvs.height = h;
          cvs.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve({ base64: cvs.toDataURL('image/jpeg', 0.6), mimeType: 'image/jpeg' });
        };
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdpaAccepted) { setError('กรุณายอมรับนโยบายคุ้มครองข้อมูลส่วนบุคคล'); return; }
    if (isCanvasEmpty()) { setError('กรุณาเซ็นชื่อก่อนบันทึกข้อมูล'); return; }
    if (!faceFile) { setError('กรุณาอัปโหลดรูปใบหน้า'); return; }

    setSubmitting(true);
    setError('');

    try {
      // Upload face image to API (base64)
      const faceData = await compressImage(faceFile);
      const signatureBase64 = canvasRef.current!.toDataURL('image/png');

      // Upload images
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          face: faceData.base64,
          consent: signatureBase64,
          hn: initialData.hn,
        }),
      });
      const { faceUrl, consentUrl } = await uploadRes.json();

      // Create patient
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, phone, allergies, disease, source, salesName,
          faceImageUrl: faceUrl,
          consentImageUrl: consentUrl,
        }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setSuccess(`บันทึกข้อมูลสำเร็จ รหัส: ${data.hn}`);
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).liff?.isInClient()) {
          (window as any).liff.closeWindow();
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md p-6">
        <h1 className="text-xl font-bold text-center text-gray-800 mb-6">ลงทะเบียนประวัติคนไข้ใหม่</h1>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium text-center">
            ✅ {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* HN */}
          <div>
            <Label>รหัสคนไข้ (HN)</Label>
            <Input value={initialData.hn} readOnly className="bg-gray-100 font-bold text-gray-600 mt-1" />
          </div>

          {/* ชื่อ */}
          <div>
            <Label>ชื่อ-นามสกุล *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} required className="mt-1" placeholder="ชื่อ นามสกุล" />
          </div>

          {/* เบอร์โทร */}
          <div>
            <Label>เบอร์โทรศัพท์ *</Label>
            <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="mt-1" placeholder="0812345678" />
          </div>

          {/* แพ้ยา */}
          <div>
            <Label>ประวัติแพ้ยา</Label>
            <Input value={allergies} onChange={e => setAllergies(e.target.value)} className="mt-1" placeholder="ไม่มี / ระบุชื่อยา" />
          </div>

          {/* โรคประจำตัว */}
          <div>
            <Label>โรคประจำตัว</Label>
            <Input value={disease} onChange={e => setDisease(e.target.value)} className="mt-1" placeholder="ไม่มี / ระบุโรค" />
          </div>

          {/* รูปใบหน้า */}
          <div>
            <Label>อัปโหลดรูปใบหน้า *</Label>
            <Input type="file" accept="image/*" onChange={e => setFaceFile(e.target.files?.[0] ?? null)} required className="mt-1" />
          </div>

          {/* แหล่งที่มา */}
          <div>
            <Label>แหล่งที่มา</Label>
            <Select value={source} onValueChange={(v) => setSource(v ?? '')}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Facebook', 'Tiktok', 'Instagram', 'Google', 'Walk-in', 'Friend'].map(s => (
                  <SelectItem key={s} value={s}>{s === 'Friend' ? 'เพื่อนแนะนำ' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* เซลล์ */}
          <div>
            <Label>ชื่อเซลล์</Label>
            <Select value={salesName} onValueChange={(v) => setSalesName(v ?? '')}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="-- เลือกชื่อเซลล์ --" /></SelectTrigger>
              <SelectContent>
                {initialData.sales.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PDPA */}
          <div className="border rounded-lg p-3 bg-gray-50 text-xs text-gray-600 leading-relaxed h-28 overflow-y-auto">
            <strong>นโยบายว่าด้วยการคุ้มครองข้อมูลส่วนบุคคล พลอยใสคลินิก</strong><br />
            บริษัท พลอยใส คลินิก จำกัด เคารพสิทธิในความเป็นส่วนตัวของท่าน โดยบริษัทฯ จะดำเนินการเก็บรวบรวม การใช้ การประมวลผล และการเปิดเผยข้อมูลส่วนบุคคลด้วยความระมัดระวัง...
            <br /><br />
            <a href="https://docs.google.com/document/d/1kSQs55iZPIM8FRd8n850bzba7fWh6P-ncK0vmwF0Qxc" target="_blank" className="text-green-600 underline font-medium">คลิกเพื่ออ่านนโยบายฉบับเต็ม</a>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={pdpaAccepted} onChange={e => setPdpaAccepted(e.target.checked)} className="mt-1 w-4 h-4 flex-shrink-0" />
            <span className="text-sm text-gray-700">ข้าพเจ้าได้อ่านและยอมรับ <strong>นโยบายคุ้มครองข้อมูลส่วนบุคคล</strong></span>
          </label>

          {/* ลายเซ็น */}
          <div>
            <Label className="text-green-600">ลายมือชื่อผู้ป่วย *</Label>
            <canvas
              ref={canvasRef}
              className="mt-1 w-full border-2 border-dashed border-green-400 rounded-lg bg-white touch-none"
              style={{ height: 180 }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            <button type="button" onClick={clearSignature}
              className="mt-2 w-full py-2 bg-red-500 text-white text-sm rounded-lg">
              ลบลายเซ็นเพื่อเขียนใหม่
            </button>
          </div>

          <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 py-3 text-base">
            {submitting ? 'กำลังประมวลผล...' : 'บันทึกข้อมูล'}
          </Button>
        </form>
      </div>
    </div>
  );
}
