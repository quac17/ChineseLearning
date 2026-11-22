import type { MetadataRoute } from 'next';

/**
 * PWA manifest: learners can add Vân Kính to their home screen (Android
 * Chrome install prompt, iOS Safari "Thêm vào màn hình chính"). iOS reads the
 * name and status bar from `appleWebApp` in layout.tsx and the icon from
 * app/apple-icon.png. The service worker is public/sw.js.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Vân Kính – Học tiếng Trung',
    short_name: 'Vân Kính',
    description: 'Khoá học video tiếng Trung cho người Việt: HSK, YCT, thiếu nhi và giao tiếp.',
    lang: 'vi',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['education'],
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Khoá học của tôi', url: '/my-courses', icons: [{ src: '/brand/icon-192.png', sizes: '192x192' }] },
      { name: 'Ôn tập', url: '/flashcards', icons: [{ src: '/brand/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
