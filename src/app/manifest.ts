import type { MetadataRoute } from 'next'

/**
 * What the site becomes when someone saves it to a phone.
 *
 * The name under the icon has to survive being truncated at about a dozen
 * characters, so it is the falcon, not the full program name.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Green Hope Falcons Lacrosse',
    short_name: 'Falcons',
    description:
      'Schedule, rosters, news, and the team hub for Green Hope Falcons lacrosse.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#00693E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
