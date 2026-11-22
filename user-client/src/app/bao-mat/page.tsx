import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import privacy from '@/content/legal/privacy.md';

export const metadata: Metadata = { title: 'Chính sách bảo mật' };

export default function PrivacyPage() {
  return <LegalPage source={privacy} path="/bao-mat" />;
}
