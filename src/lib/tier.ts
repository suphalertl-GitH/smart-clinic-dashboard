import { getSupabaseAdmin } from './supabase';
import { NextResponse } from 'next/server';

export type Tier = 'starter' | 'professional' | 'enterprise';

const TIER_RANK: Record<Tier, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
};

const TIER_LABEL: Record<Tier, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

/** ดึง tier ของ clinic จาก DB */
export async function getClinicTier(clinicId: string): Promise<Tier> {
  const { data } = await getSupabaseAdmin()
    .from('clinics')
    .select('tier, is_active')
    .eq('id', clinicId)
    .single();

  if (!data || data.is_active === false) return 'starter';
  return (data.tier as Tier) ?? 'starter';
}

/** ตรวจว่า tier ปัจจุบันมีสิทธิ์ใช้ feature นั้นหรือไม่ */
export function tierHasAccess(clinicTier: Tier, minTier: Tier): boolean {
  return TIER_RANK[clinicTier] >= TIER_RANK[minTier];
}

/**
 * ถ้า tier ไม่ผ่าน → คืน NextResponse 403
 * ถ้าผ่าน → คืน null (ให้ route ทำงานต่อ)
 */
export async function requireTier(clinicId: string, minTier: Tier): Promise<NextResponse | null> {
  const tier = await getClinicTier(clinicId);
  if (!tierHasAccess(tier, minTier)) {
    return NextResponse.json(
      {
        error: `ฟีเจอร์นี้ต้องการแพ็กเกจ ${TIER_LABEL[minTier]} ขึ้นไป`,
        required_tier: minTier,
        current_tier: tier,
      },
      { status: 403 }
    );
  }
  return null;
}
