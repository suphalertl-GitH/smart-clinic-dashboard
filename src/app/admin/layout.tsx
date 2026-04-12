// Root layout for /admin — no auth check here.
// Auth guard is in /admin/(panel)/layout.tsx (applies to /admin only, not /admin/login)
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
