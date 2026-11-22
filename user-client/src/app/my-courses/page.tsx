'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, CourseCard, EmptyState, LinkButton, Skeleton, Tabs } from '@/components/ui';
import { formatClock } from '@/components/course/useCourseProgress';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import type { MyCourseProgress, ProgramModule } from '@/lib/types';
import s from './my-courses.module.css';

/** Shape of GET /enrollments/my (courses opened for this student by purchase or by a teacher). */
interface MyEnrollment {
  id: string;
  courseId: string;
  canView: boolean;
  course: { id: string; title: string; module: ProgramModule; description?: string | null; isFree: boolean };
}

type TabId = 'all' | 'active' | 'done';

interface Item {
  courseId: string;
  title: string;
  module: ProgramModule;
  progress: MyCourseProgress | null;
  state: 'new' | 'active' | 'done';
}

export default function MyCoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const [enrollments, setEnrollments] = useState<MyEnrollment[] | null>(null);
  const [progress, setProgress] = useState<MyCourseProgress[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('all');

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') return;
    let cancelled = false;
    setEnrollments(null);
    setProgress(null);
    setError('');
    Promise.all([
      apiRequest<MyEnrollment[]>('/enrollments/my'),
      apiRequest<MyCourseProgress[]>('/progress/me').catch(() => [] as MyCourseProgress[]),
    ])
      .then(([e, p]) => {
        if (cancelled) return;
        setEnrollments(e);
        setProgress(p);
      })
      .catch((err: Error) => !cancelled && setError(err.message || 'Không thể tải khoá học của bạn.'));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Opened courses, plus free courses the learner has started.
  const items = useMemo<Item[] | null>(() => {
    if (!enrollments || !progress) return null;
    const byCourse = new Map(progress.map((p) => [p.courseId, p]));
    const list: Item[] = enrollments.map((e) => toItem(e.courseId, e.course.title, e.course.module, byCourse.get(e.courseId) ?? null));
    const seen = new Set(list.map((i) => i.courseId));
    for (const p of progress) if (!seen.has(p.courseId)) list.push(toItem(p.courseId, p.courseTitle, p.module, p));
    // Most recently studied first, then the ones not started yet.
    const time = (i: Item) => (i.progress ? new Date(i.progress.lastActivityAt).getTime() : 0);
    return list.sort((a, b) => time(b) - time(a));
  }, [enrollments, progress]);

  const counts = useMemo(
    () => ({
      all: items?.length ?? 0,
      active: items?.filter((i) => i.state !== 'done').length ?? 0,
      done: items?.filter((i) => i.state === 'done').length ?? 0,
    }),
    [items],
  );
  const visible = items?.filter((i) => tab === 'all' || (tab === 'done' ? i.state === 'done' : i.state !== 'done')) ?? [];
  const resume = progress?.find((p) => p.completedCount < p.totalLessons) ?? null;

  return (
    <>
      <div className={s.band}>
        <div className={`container ${s.bandInner}`}>
          <h1 className={s.title}>Khoá học của tôi</h1>
          {user?.role === 'STUDENT' && items && items.length > 0 && (
            <p className={s.subtitle}>
              {counts.all} khoá học · {counts.done} đã xong
            </p>
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
            <LinkButton href={routes.login(routes.myCourses)} variant="ink">
              Đăng nhập
            </LinkButton>
          }
        >
          Khoá học đã mua hoặc được mở khoá sẽ hiện ở đây.
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
      <>
        {resume && (
          <section className={s.resume} aria-labelledby="hoc-tiep">
            <div className={s.resumeText}>
              <h2 id="hoc-tiep">Học tiếp</h2>
              <b>
                {resume.courseTitle} ·{' '}
                {resume.lastLesson.completed ? `Vừa học xong: ${resume.lastLesson.title}` : resume.lastLesson.title}
              </b>
              <span className={s.muted}>
                {!resume.lastLesson.completed && resume.lastLesson.positionSeconds > 0
                  ? `Dừng ở ${formatClock(resume.lastLesson.positionSeconds)}${
                      resume.lastLesson.durationSeconds ? ` / ${formatClock(resume.lastLesson.durationSeconds)}` : ''
                    } · `
                  : ''}
                {relativeDay(resume.lastActivityAt)}
              </span>
            </div>
            <LinkButton href={routes.learn(resume.courseId)} variant="ink">
              Học tiếp
            </LinkButton>
          </section>
        )}

        <Tabs<TabId>
          label="Lọc khoá học"
          idPrefix="my-tab"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'all', label: `Tất cả (${counts.all})` },
            { id: 'active', label: `Đang học (${counts.active})` },
            { id: 'done', label: `Đã xong (${counts.done})` },
          ]}
        />

        <div role="tabpanel" id={`my-tab-panel-${tab}`} aria-labelledby={`my-tab-${tab}`}>
          {visible.length === 0 ? (
            <p className={s.muted}>
              {tab === 'done' ? 'Chưa có khoá nào học xong.' : 'Không còn khoá nào đang học dở.'}
            </p>
          ) : (
            <div className={s.grid}>
              {visible.map((i) => (
                <CourseCard
                  key={i.courseId}
                  href={routes.learn(i.courseId)}
                  title={i.title}
                  program={i.module}
                  progress={progressOf(i)}
                />
              ))}
              {tab !== 'done' && (
                <div className={s.next}>
                  <b>Tìm khoá tiếp theo</b>
                  <span>Xem các khoá khác trong chương trình bạn đang học.</span>
                  <LinkButton href={routes.catalog()} variant="outline" size="sm">
                    Khám phá khoá học
                  </LinkButton>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }
}

function toItem(courseId: string, title: string, module: ProgramModule, p: MyCourseProgress | null): Item {
  const state: Item['state'] = !p ? 'new' : p.totalLessons > 0 && p.completedCount >= p.totalLessons ? 'done' : 'active';
  return { courseId, title, module, progress: p, state };
}

function progressOf(i: Item): { percent: number; label: string } {
  const p = i.progress;
  if (!p || p.totalLessons === 0) return { percent: 0, label: 'Chưa bắt đầu' };
  const percent = Math.round((p.completedCount / p.totalLessons) * 100);
  if (i.state === 'done') return { percent: 100, label: 'Đã hoàn thành' };
  return { percent, label: `${percent}% · ${p.completedCount} / ${p.totalLessons} bài` };
}

/** "hôm nay" / "hôm qua" / "3 ngày trước" / a date. */
function relativeDay(iso: string): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000);
  if (diff <= 0) return 'hôm nay';
  if (diff === 1) return 'hôm qua';
  if (diff < 7) return `${diff} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
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
