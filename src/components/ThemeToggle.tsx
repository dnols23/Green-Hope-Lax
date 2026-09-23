'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { THEME_EVENT, THEME_KEY, isThemeChoice, type ThemeChoice } from '@/lib/theme'

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return isThemeChoice(v) ? v : 'light'
  } catch {
    return 'light'
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(THEME_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && systemDark())
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch {}
  apply(choice)
  window.dispatchEvent(new Event(THEME_EVENT))
}

/** The coach's choice, and whether the screen is dark right now. */
export function useTheme(): { choice: ThemeChoice; dark: boolean } {
  const choice = useSyncExternalStore(subscribe, read, () => 'light' as ThemeChoice)
  // "Match my phone" follows the phone when it changes at sunset.
  useEffect(() => {
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      apply('system')
      window.dispatchEvent(new Event(THEME_EVENT))
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])
  const dark = choice === 'dark' || (choice === 'system' && systemDark())
  return { choice, dark }
}

const Sun = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
const Moon = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
  </svg>
)

/** One tap: light to dark and back. Sits in the green bar, so it's drawn for green. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark } = useTheme()
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white ${className}`}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  )
}

/** Light · Dark · Match my phone — for the menu, where there's room to spell it out. */
export function ThemeChoices() {
  const { choice } = useTheme()
  const options: { key: ThemeChoice; label: string }[] = [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'system', label: 'Match my device' },
  ]
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex rounded-lg bg-white/10 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={choice === o.key}
          onClick={() => setTheme(o.key)}
          className={`px-2.5 py-1 rounded-md text-xs font-bold ${
            choice === o.key ? 'bg-white text-[#00512F]' : 'text-white/80 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
