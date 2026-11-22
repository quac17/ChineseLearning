'use client';

import type { ReactNode } from 'react';
import { RoleGate } from '@/components/layout/StatePage';

/** Cosmetic gate for the teacher area; the API enforces TEACHER/ADMIN and course ownership. */
export function TeacherOnly({ children }: { children: ReactNode }) {
  return <RoleGate roles={['TEACHER', 'ADMIN']}>{children}</RoleGate>;
}
