import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { pushGroupMessage, textMessage } from '@/lib/line';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/patients?search=HN00001
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search') ?? '';

  const query = supabaseAdmin
    .from('patients')
    .select('id, hn, full_name, phone, sales_name, line_user_id, points')
    .eq('clinic_id', CLINIC_ID)
    .order('created_at', { ascending: false })
    .limit(200);

  if (search) {
    query.or(`hn.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/patients — ลงทะเบียนคนไข้ใหม่
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, phone, allergies, disease, source, salesName, faceImageUrl, consentImageUrl, lineUserId } = body;

    if (!fullName || !phone) {
      return NextResponse.json({ error: 'ชื่อและเบอร์โทรจำเป็นต้องกรอก' }, { status: 400 });
    }

    // Generate HN
    const { data: lastPatient } = await supabaseAdmin
      .from('patients')
      .select('hn')
      .eq('clinic_id', CLINIC_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastPatient?.hn) {
      const match = lastPatient.hn.match(/(\d+)/);
      if (match) nextNum = parseInt(match[0]) + 1;
    }
    const hn = 'HN' + nextNum.toString().padStart(5, '0');

    const { data, error } = await supabaseAdmin
      .from('patients')
      .insert({
        clinic_id: CLINIC_ID,
        hn,
        full_name: fullName,
        phone,
        allergies: allergies || null,
        disease: disease || null,
        source: source || null,
        sales_name: salesName || null,
        face_image_url: faceImageUrl || null,
        consent_image_url: consentImageUrl || null,
        line_user_id: lineUserId || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // แจ้ง LINE Group
    const salesTag = salesName ? ` (${salesName})` : '';
    pushGroupMessage([textMessage(
      `🆕 ลูกค้าใหม่${salesTag}\n👤 ${fullName}  📞 ${phone}\n🏷️ ${hn}`
    )]).catch(() => {}); // fire-and-forget

    return NextResponse.json({ success: true, hn, patient: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
