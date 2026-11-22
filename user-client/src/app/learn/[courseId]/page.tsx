'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { useCourse } from '@/components/course/useCourse';
import { useCourseProgress } from '@/components/course/useCourseProgress';
import { resumeLesson, routes } from '@/lib/courses';
import s from '../player.module.css';

/** /learn/<course> continues where the learner stopped ("Học tiếp"), else the first lesson. */
export default function LearnCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { course, error } = useCourse(courseId);
  const { progress, ready } = useCourseProgress(courseId);
  const start = course && ready ? resumeLesson(course, progress) : null;

  useEffect(() => {
    if (start) router.replace(routes.learn(courseId, start.id));
  }, [start, courseId, router]);

  if (error || (course && ready && !start)) {
    return (
      <div className={s.state}>
        <EmptyState
          title={error ? 'Không tìm thấy khoá học' : 'Khoá học chưa có bài giảng'}
          action={
            <LinkButton href={error ? routes.catalog() : routes.course(courseId)} variant="outline">
              {error ? 'Xem tất cả khoá học' : 'Về trang khoá học'}
            </LinkButton>
          }
        >
          {error || 'Giáo viên đang chuẩn bị nội dung. Quay lại sau nhé.'}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={s.state} aria-busy="true" aria-label="Đang mở bài học">
      <Skeleton height="auto" style={{ aspectRatio: '16 / 9' }} />
    </div>
  );
}
