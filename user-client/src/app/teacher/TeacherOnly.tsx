'use client';

import type { ReactNode } from 'react';
import { EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

/** Cosmetic gate for the teacher area; the API enforces TEACHER/ADMIN and course ownership. */
export function TeacherOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Skeleton height={240} />;
  if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
    return (
      <EmptyState
        title="Khu vực dành cho Giáo viên"
        action={
          <LinkButton href="/login?next=/teacher" variant="ink">
            Đăng nhập
          </LinkButton>
        }
      >
        Vui lòng đăng nhập bằng tài khoản Giáo viên hoặc Admin để quản lý khoá học.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
