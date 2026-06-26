import { createClient } from '@/lib/supabase-server'
import { PublishToggle } from '@/components/admin/PublishToggle'
import type { PageSetting } from '@/lib/types'

export const metadata = { title: 'Manage Pages' }

export default async function AdminPagesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('page_settings')
    .select('*')
    .order('sort_order', { ascending: true })
  const pages = (data as PageSetting[]) ?? []

  return (
    <div>
      <h1 className="text-xl font-black mb-1">Pages</h1>
      <p className="text-sm text-gray-500 mb-6">
        Turn whole pages on or off. A <strong>Hidden</strong> page disappears from the site
        menu and returns “not found” if visited directly — handy for building out a page
        (like Record Books) before you’re ready to show it.
      </p>

      {pages.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          No pages found. Run <code>supabase/migrations/0007_pages.sql</code> in the Supabase
          SQL Editor to set up the page list.
        </div>
      ) : (
        <div className="card divide-y">
          {pages.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">{p.label}</div>
                <div className="text-xs text-gray-400">{p.href}</div>
              </div>
              <PublishToggle entity="page" id={p.id} live={p.is_published} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
