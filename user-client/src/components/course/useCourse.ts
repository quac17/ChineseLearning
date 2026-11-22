'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import type { CourseItem } from '@/lib/types';

/**
 * Loads one course as the current viewer sees it. Refetches when the user
 * changes, because lesson access (canWatch, youtubeId) depends on who asks.
 */
export function useCourse(courseId: string) {
  const { user, loading: authLoading } = useAuth();
  const [course, setCourse] = useState<CourseItem | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setError('');
    apiRequest<CourseItem>(`/courses/${encodeURIComponent(courseId)}`)
      .then((data) => !cancelled && setCourse(data))
      .catch((err: Error) => {
        if (cancelled) return;
        setCourse(null);
        setError(err.message || 'Không thể tải khoá học.');
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, user?.id, authLoading]);

  return { course, error, loading: !course && !error };
}
