import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (user.user_metadata?.role !== 'super_admin') redirect('/dashboard');
  return <>{children}</>;
}
