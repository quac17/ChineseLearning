'use client';

import { useEffect, useState } from 'react';
import { Alert, CourseCard, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import type { ProgramModule } from '@/lib/types';
import s from './my-courses.module.css';

/** Shape of GET /enrollments/my (courses the teacher or admin has opened for this student). */
interface MyEnrollment {
  id: string;
  courseId: string;
  canView: boolean;
  course: { id: string; title: string; module: ProgramModule; description?: string | null; isFree: boolean };
}

export default function MyCoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<MyEnrollment[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') return;
    let cancelled = false;
    setItems(null);
    setError('');
    apiRequest<MyEnrollment[]>('/enrollments/my')
      .then((data) => !cancelled && setItems(data))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không thể tải khoá học của bạn.'));
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <div className={s.band}>
        <div className={`container ${s.bandInner}`}>
          <h1 className={s.title}>Khoá học của tôi</h1>
          {user?.role === 'STUDENT' && items && items.length > 0 && (
            <p className={s.subtitle}>{items.length} khoá học đã mở khoá</p>
          )}
        </div>
      </div>
      <div className={`container ${s.body}`}>{renderBody()}</div>
    </>
  );

  function renderBody() {
    if (authLoading) return <GridSkeleton />;

    if (!user) {
      return (
        <EmptyState
          title="Đăng nhập để xem khoá học của bạn"
          action={
            <LinkButton href="/login" variant="ink">
              Đăng nhập
            </LinkButton>
          }
        >
          Khoá học đã được mở khoá cho tài khoản sẽ hiện ở đây.
        </EmptyState>
      );
    }

    if (user.role !== 'STUDENT') {
      const area = user.role === 'ADMIN' ? '/admin' : '/teacher';
      return (
        <EmptyState
          title="Tài khoản này quản lý khoá học"
          action={
            <LinkButton href={area} variant="ink">
              {user.role === 'ADMIN' ? 'Vào trang quản trị' : 'Vào khu giáo viên'}
            </LinkButton>
          }
        >
          Giáo viên và quản trị viên xem được mọi bài trong khoá mình quản lý từ trang khoá học.
        </EmptyState>
      );
    }

    if (error) {
      return (
        <Alert tone="error" title="Không tải được khoá học.">
          {error}
        </Alert>
      );
    }

    if (!items) return <GridSkeleton />;

    if (items.length === 0) {
      return (
        <EmptyState
          title="Bạn chưa có khoá học nào"
          action={
            <LinkButton href={routes.catalog()} variant="accent">
              Xem bài học thử
            </LinkButton>
          }
        >
          Bắt đầu bằng một bài học thử miễn phí, không cần thanh toán.
        </EmptyState>
      );
    }

    return (
      <div className={s.grid}>
        {items.map((e) => (
          <CourseCard
            key={e.id}
            href={routes.learn(e.courseId)}
            title={e.course.title}
            program={e.course.module}
            meta="Mở để học tiếp"
          />
        ))}
        <div className={s.next}>
          <b>Tìm khoá tiếp theo</b>
          <span>Xem các khoá khác trong chương trình bạn đang học.</span>
          <LinkButton href={routes.catalog()} variant="outline" size="sm">
            Khám phá khoá học
          </LinkButton>
        </div>
      </div>
    );
  }
}

function GridSkeleton() {
  return (
    <div className={s.grid} aria-busy="true" aria-label="Đang tải khoá học">
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton height="auto" style={{ aspectRatio: '16 / 9' }} />
          <Skeleton width="80%" height={18} />
          <Skeleton width="40%" />
        </div>
      ))}
    </div>
  );
}
