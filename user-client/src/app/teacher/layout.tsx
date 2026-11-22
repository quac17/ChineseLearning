import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TeacherOnly } from './TeacherOnly';

export const metadata: Metadata = { title: 'Khu giáo viên' };

/** Every /teacher page needs a TEACHER or ADMIN account (the API checks it again). */
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <TeacherOnly>{children}</TeacherOnly>;
}
