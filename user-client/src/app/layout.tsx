import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ModuleProvider } from '@/context/ModuleContext';
import { AppChrome } from '@/components/layout/AppChrome';
import { OfflineBar } from '@/components/layout/StatePage';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: {
    default: 'Chinese Learner – Học tiếng Trung cho người Việt',
    template: '%s · Chinese Learner',
  },
  description:
    'Khoá học video tiếng Trung cho người Việt: HSK, YCT, thiếu nhi và giao tiếp. Học thử miễn phí bài đầu tiên của mọi khoá.',
  applicationName: 'Chinese Learner',
  appleWebApp: { capable: true, title: 'Chinese Learner', statusBarStyle: 'default' },
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
const THEME_SCRIPT = `try{var t=localStorage.getItem('chinese_learner_theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

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
              <OfflineBar />
              <AppChrome>{children}</AppChrome>
            </ToastProvider>
          </ModuleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
