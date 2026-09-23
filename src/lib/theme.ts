// Light or dark, for the coaches' app.
//
// Kept in the coach's own browser. 'system' follows the phone or laptop's own
// setting and changes with it. The script below runs in <head> before anything
// paints, so a coach who picked dark never sees a flash of white.

export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_KEY = 'gh-theme'
export const THEME_EVENT = 'gh-theme-changed'

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === 'light' || v === 'dark' || v === 'system'
}

/** Inlined into the root layout's <head>. Light unless the coach chose otherwise. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})()`
