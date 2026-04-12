import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // super_admin เข้า /dashboard ได้ปกติ — ไม่บังคับ redirect ไป /admin
  return <>{children}</>;
}
