'use client';

import type { ReactNode } from 'react';
import { EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

/** Cosmetic gate for rebuilt admin pages; the API enforces the ADMIN role. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Skeleton height={240} />;
  if (!user || user.role !== 'ADMIN') {
    return (
      <EmptyState
        title="Khu vực chỉ dành cho Quản trị viên"
        action={
          <LinkButton href="/login?next=/admin" variant="ink">
            Đăng nhập
          </LinkButton>
        }
      >
        Vui lòng đăng nhập bằng tài khoản Admin.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
