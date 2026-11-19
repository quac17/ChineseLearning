import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ModuleProvider } from '@/context/ModuleContext';
import { WaveBackground } from '@/components/WaveBackground';
import { Header } from '@/components/Header';
import { SITE_INFO } from '@/lib/modules';

export const metadata: Metadata = {
  title: '云径 · Vân Kính – Học tiếng Trung cho người Việt',
  description:
    'Nền tảng học tiếng Trung cho người Việt với video bài giảng, tài liệu Word/PowerPoint, Flashcard, Quiz và luyện viết chữ Hán.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <ModuleProvider>
            <WaveBackground />
            <Header />
            <main>{children}</main>
            <footer>{SITE_INFO.contactText}</footer>
          </ModuleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
