import type { MetadataRoute } from 'next';

/** PWA manifest: learners can add Vân Kính to their home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vân Kính – Học tiếng Trung',
    short_name: 'Vân Kính',
    description: 'Khoá học video tiếng Trung cho người Việt: HSK, YCT, thiếu nhi và giao tiếp.',
    lang: 'vi',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/app-icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
