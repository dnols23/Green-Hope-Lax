import Link from 'next/link'

export interface HubTab {
  key: string
  label: string
  icon: string
  href: string
}

/**
 * The tab strip for a sidebar entry that covers more than one page — one
 * entry, its pages as tabs across the top.
 */
export function HubTabs({ title, tabs, active }: { title: string; tabs: HubTab[]; active: string }) {
  return (
    <div className="mb-4">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400 mb-1.5">{title}</div>
      <nav className="inline-flex flex-wrap rounded-full border p-0.5 bg-white" style={{ borderColor: 'var(--border)' }} aria-label={title}>
        {tabs.map((t) => {
          const on = t.key === active
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`px-3.5 min-h-9 inline-flex items-center gap-1.5 rounded-full text-sm font-bold transition-colors ${
                on ? 'bg-[var(--gh-green)] text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
