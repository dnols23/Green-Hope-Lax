import { AdminShell } from '@/components/admin/AdminShell'

// Same menu bar, but the page gets the full width and the leftover height.
// The Film Room lives here: boxing the board into a centred column wastes most
// of the screen, which is the one thing film review can't spare.
export default function AdminFullBleedLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell fullBleed>{children}</AdminShell>
}
