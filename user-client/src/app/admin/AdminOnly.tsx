'use client';

import type { ReactNode } from 'react';
import { RoleGate } from '@/components/layout/StatePage';

/** Cosmetic gate for rebuilt admin pages; the API enforces the ADMIN role. */
export function AdminOnly({ children }: { children: ReactNode }) {
  return <RoleGate roles={['ADMIN']}>{children}</RoleGate>;
}
