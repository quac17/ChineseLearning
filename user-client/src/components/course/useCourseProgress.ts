'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import type { CourseProgress, LessonProgress } from '@/lib/types';

interface SavePayload {
  completed?: boolean;
  positionSeconds?: number;
  durationSeconds?: number;
}

/**
 * The current learner's progress in one course. Logged-out visitors get
 * `null` and `save` does nothing. `save` updates local state from the
 * server's answer, so the 90% rule shows up without a reload.
 */
export function useCourseProgress(courseId: string) {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  /** True once we know the progress (or that there is none to load). */
  const [ready, setReady] = useState(false);
  const latest = useRef(courseId);
  latest.current = courseId;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProgress(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    apiRequest<CourseProgress>(`/progress/courses/${encodeURIComponent(courseId)}`)
      .then((p) => !cancelled && setProgress(p))
      .catch(() => !cancelled && setProgress(null))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [courseId, user, authLoading]);

  const save = useCallback(
    async (lessonId: string, payload: SavePayload): Promise<LessonProgress | null> => {
      if (!user) return null;
      const row = await apiRequest<LessonProgress>(`/progress/lessons/${encodeURIComponent(lessonId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (latest.current !== row.courseId) return row;
      setProgress((prev) => {
        if (!prev) return prev;
        const others = prev.lessons.filter((l) => l.lessonId !== row.lessonId);
        const lessons = [row, ...others];
        return {
          ...prev,
          lessons,
          lastLessonId: row.lessonId,
          completedCount: lessons.filter((l) => l.completed).length,
        };
      });
      return row;
    },
    [user],
  );

  const byLesson = (lessonId: string) => progress?.lessons.find((l) => l.lessonId === lessonId) ?? null;

  return { progress, ready, save, byLesson, enabled: Boolean(user) };
}

/** "06:12" / "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
