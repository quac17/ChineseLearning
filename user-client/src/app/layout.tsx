import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ModuleProvider } from '@/context/ModuleContext';
import { AppChrome } from '@/components/layout/AppChrome';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: {
    default: 'Vân Kính – Học tiếng Trung cho người Việt',
    template: '%s · Vân Kính',
  },
  description:
    'Khoá học video tiếng Trung cho người Việt: HSK, YCT, thiếu nhi và giao tiếp. Học thử miễn phí bài đầu tiên của mọi khoá.',
  applicationName: 'Vân Kính',
  appleWebApp: { capable: true, title: 'Vân Kính', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#16171a' },
  ],
};

/** Sets data-theme before first paint so dark mode does not flash. */
const THEME_SCRIPT = `try{var t=localStorage.getItem('vankinh_theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Noto+Serif+SC:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        <AuthProvider>
          <ModuleProvider>
            <ToastProvider>
              <AppChrome>{children}</AppChrome>
            </ToastProvider>
          </ModuleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
