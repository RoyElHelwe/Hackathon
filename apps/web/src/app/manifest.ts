import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tajriba — learn by living',
    short_name: 'Tajriba',
    description: 'Real-life missions, level up like a game, learn from your peers.',
    start_url: '/student',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8FF',
    theme_color: '#6C4CF1',
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
