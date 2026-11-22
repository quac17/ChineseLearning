import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import terms from '@/content/legal/terms.md';

export const metadata: Metadata = { title: 'Điều khoản sử dụng' };

export default function TermsPage() {
  return <LegalPage source={terms} path="/dieu-khoan" />;
}
