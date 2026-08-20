import { AdminShell } from '@/components/admin/AdminShell'

// Ordinary admin pages: menu bar, then a centred column.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
