'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ApiError, apiRequest } from '@/lib/api';
import type { CourseItem } from '@/lib/types';

/**
 * Loads one course as the current viewer sees it. Refetches when the user
 * changes, because lesson access (canWatch, youtubeId) depends on who asks.
 *
 * A 4xx sets `error` (the page shows "not found"). A 5xx or a network failure
 * is thrown during render instead, so app/error.tsx shows "Không tải được nội
 * dung" with "Thử lại".
 */
export function useCourse(courseId: string) {
  const { user, loading: authLoading } = useAuth();
  const [course, setCourse] = useState<CourseItem | null>(null);
  const [error, setError] = useState('');
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setError('');
    apiRequest<CourseItem>(`/courses/${encodeURIComponent(courseId)}`)
      .then((data) => !cancelled && setCourse(data))
      .catch((err: Error) => {
        if (cancelled) return;
        setCourse(null);
        if (err instanceof ApiError && err.status < 500) setError(err.message || 'Không thể tải khoá học.');
        else setFailure(err);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, user?.id, authLoading]);

  if (failure) throw failure;

  return { course, error, loading: !course && !error };
}
