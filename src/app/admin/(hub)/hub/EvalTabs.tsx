import Link from 'next/link'

const TABS = [
  { key: 'evaluate', label: 'Evaluate', icon: '📝', href: '/admin/hub/evaluate' },
  { key: 'mine', label: 'Mine', icon: '📋', href: '/admin/hub/mine' },
  { key: 'board', label: 'Board', icon: '📊', href: '/admin/hub/board' },
] as const

/**
 * Evaluations is one place with three views: score a player, what you've
 * filed, and every coach's scores side by side. One sidebar entry; the tabs
 * move between them.
 */
export function EvalTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <div className="mb-4">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400 mb-1.5">Evaluations</div>
      <nav className="inline-flex rounded-full border p-0.5 bg-white" style={{ borderColor: 'var(--border)' }} aria-label="Evaluations">
        {TABS.map((t) => {
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
