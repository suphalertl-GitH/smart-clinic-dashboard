import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import ClinicLoginClient from './_client';

export default async function ClinicSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: clinic } = await getSupabaseAdmin()
    .from('clinics')
    .select('id, name, slug, is_active')
    .eq('slug', slug)
    .single();

  if (!clinic || clinic.is_active === false) notFound();

  return <ClinicLoginClient clinic={clinic} />;
}
