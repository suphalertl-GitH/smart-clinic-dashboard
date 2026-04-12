import { getSupabaseAdmin } from './supabase';
import { NextResponse } from 'next/server';

export type Tier = 'starter' | 'professional' | 'enterprise' | 'custom';

export type FeatureKey =
  | 'sales_analytics'
  | 'customer_insights'
  | 'ai_summary'
  | 'promotions'
  | 'crm'
  | 'promptpay'
  | 'google_sheets'
  | 'predictive'
  | 'followup_bot'
  | 'clinic_ops';

/** Features included in each standard tier */
export const TIER_FEATURES: Record<Exclude<Tier, 'custom'>, FeatureKey[]> = {
  starter: ['sales_analytics'],
  professional: [
    'sales_analytics', 'customer_insights', 'ai_summary',
    'promotions', 'crm', 'promptpay', 'google_sheets', 'clinic_ops',
  ],
  enterprise: [
    'sales_analytics', 'customer_insights', 'ai_summary',
    'promotions', 'crm', 'promptpay', 'google_sheets',
    'predictive', 'followup_bot', 'clinic_ops',
  ],
};

/** Metadata สำหรับแสดงผล — ใช้ใน admin panel ด้วย */
export const FEATURE_META: { key: FeatureKey; label: string; desc: string }[] = [
  { key: 'sales_analytics',   label: 'Sales Analytics',      desc: 'รายงานและวิเคราะห์ยอดขาย' },
  { key: 'customer_insights', label: 'Customer Insights',    desc: 'วิเคราะห์พฤติกรรมลูกค้า' },
  { key: 'ai_summary',        label: 'AI Executive Summary', desc: 'สรุปรายงาน AI ในหน้าแรก' },
  { key: 'promotions',        label: 'Promotions',           desc: 'จัดการโปรโมชั่นและส่วนลด' },
  { key: 'crm',               label: 'CRM & Campaigns',      desc: 'ระบบ CRM, RFM และ campaigns' },
  { key: 'promptpay',         label: 'PromptPay QR',         desc: 'QR พร้อมเพย์ในหน้า visit' },
  { key: 'google_sheets',     label: 'Google Sheets',        desc: 'Sync ข้อมูลกับ Google Sheets' },
  { key: 'predictive',        label: 'Predictive AI',        desc: 'AI พยากรณ์ revenue/churn' },
  { key: 'followup_bot',      label: 'Smart CRM Bot',        desc: 'Bot follow-up อัตโนมัติทาง LINE' },
  { key: 'clinic_ops',        label: 'Clinic Ops',           desc: 'Heatmap นัด + workload แพทย์' },
];

/** ดึง enabled features ของ clinic */
export async function getEnabledFeatures(clinicId: string): Promise<FeatureKey[]> {
  const { data } = await getSupabaseAdmin()
    .from('clinics')
    .select('tier, is_active, custom_features')
    .eq('id', clinicId)
    .single();

  if (!data || data.is_active === false) return [];

  const tier = data.tier as Tier;
  if (tier === 'custom') {
    const cf = (data.custom_features ?? {}) as Record<string, boolean>;
    return (Object.entries(cf) as [FeatureKey, boolean][])
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
  }
  return TIER_FEATURES[tier as Exclude<Tier, 'custom'>] ?? [];
}

/** ตรวจว่า clinic มีสิทธิ์ใช้ feature นั้นหรือไม่ */
export async function hasFeature(clinicId: string, feature: FeatureKey): Promise<boolean> {
  const enabled = await getEnabledFeatures(clinicId);
  return enabled.includes(feature);
}

/**
 * ถ้าไม่มีสิทธิ์ → คืน NextResponse 403
 * ถ้ามีสิทธิ์ → คืน null
 */
export async function requireFeature(clinicId: string, feature: FeatureKey): Promise<NextResponse | null> {
  const allowed = await hasFeature(clinicId, feature);
  if (!allowed) {
    return NextResponse.json(
      { error: 'ฟีเจอร์นี้ไม่รวมในแพ็กเกจของคุณ', feature },
      { status: 403 }
    );
  }
  return null;
}

// Backward compat — used by cron/followup (skip gracefully, not 403)
export { requireFeature as requireTier };
