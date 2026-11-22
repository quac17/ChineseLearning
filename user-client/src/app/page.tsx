'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert, CourseCard, EmptyState, LinkButton, ProgressBar, Skeleton, Tabs } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest, buildMediaUrl } from '@/lib/api';
import { courseMeta, isOnSale, learnerText, routes } from '@/lib/courses';
import { PROGRAMS } from '@/lib/programs';
import { SUPPORT_CONTACT } from '@/lib/site';
import type { CourseItem, MyCourseProgress, ProgramModule } from '@/lib/types';
import s from './home.module.css';

/** Tab order on the home page (design: HSK first). */
const TABS: ProgramModule[] = ['hsk', 'yct', 'easy', 'talk'];

const PROGRAM_COPY: Record<ProgramModule, { title: string; text: string }> = {
  hsk: {
    title: 'Lộ trình HSK: thi đỗ từng cấp',
    text: 'Bài giảng video theo từng cấp, tài liệu Word / PowerPoint, flashcard và quiz bốn dạng sinh từ từ vựng của mỗi bài.',
  },
  yct: {
    title: 'YCT: tiếng Trung cho thiếu nhi',
    text: 'Bài ngắn, nhiều hình ảnh và bài hát, để bé học cùng bố mẹ và làm quen chữ Hán.',
  },
  easy: {
    title: 'Easy Steps: bắt đầu từ số 0',
    text: 'Phát âm, chào hỏi và những từ đầu tiên, nhẹ nhàng cho người mới và cho bé.',
  },
  talk: {
    title: 'Giao tiếp đời sống và công việc',
    text: 'Hội thoại thực tế: mua sắm, gọi món, du lịch, email và họp với đối tác.',
  },
};

/** Stock photos (public/images/stock, credits in the footer). Never Vân Kính's own students. */
const GOALS: Array<{ program: ProgramModule; label: string; img: string; alt: string }> = [
  { program: 'easy', label: 'Mới bắt đầu từ số 0', img: 'brush.jpg', alt: 'Cây bút lông viết thư pháp đặt trên giá sứ' },
  { program: 'yct', label: 'Cho con học YCT', img: 'kids.jpg', alt: 'Các em nhỏ cùng đọc sách trong lớp học' },
  { program: 'hsk', label: 'Thi chứng chỉ HSK', img: 'study-group.jpg', alt: 'Nhóm bạn trẻ ôn bài với sách và laptop' },
  { program: 'talk', label: 'Giao tiếp khi đi làm', img: 'tea.jpg', alt: 'Pha trà kiểu Triều Châu trên khay gỗ' },
];

export default function HomePage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ProgramModule>('hsk');

  useEffect(() => {
    let cancelled = false;
    apiRequest<CourseItem[]>('/courses')
      .then((data) => !cancelled && setCourses(data))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không tải được khoá học.'));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Courses without lessons yet stay in the catalog but are not advertised here.
  const ready = useMemo(() => (courses ?? []).filter((c) => c.lessons.length > 0), [courses]);
  const inTab = useMemo(() => ready.filter((c) => c.module === tab).slice(0, 5), [ready, tab]);
  const latest = useMemo(
    () => [...ready].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [ready],
  );

  return (
    <div className={s.page}>
      <section className={`${s.wrap} ${s.hero}`} aria-labelledby="hero-title">
        <div className={s.heroImg}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/stock/great-wall.jpg" alt="Vạn Lý Trường Thành uốn qua những dãy núi xanh" />
        </div>
        <div className={s.heroCard}>
          <h1 id="hero-title">Học tiếng Trung theo cách của bạn</h1>
          <p>Khoá học video HSK, YCT và giao tiếp cho người Việt. Xem bài học thử miễn phí trước khi mua.</p>
          <div>
            <LinkButton href={routes.catalog()} variant="accent">
              Xem bài học thử
            </LinkButton>
          </div>
        </div>
      </section>

      {user?.role === 'STUDENT' && <ContinueLearning userId={user.id} />}

      <section className={s.wrap} aria-labelledby="programs-title">
        <div className={s.sectionHead}>
          <h2 id="programs-title">Mọi cấp độ, từ chào hỏi đến HSK</h2>
          <p>Chọn chương trình, bắt đầu bằng bài học thử miễn phí.</p>
        </div>
        <Tabs<ProgramModule>
          label="Chương trình"
          idPrefix="home-tab"
          value={tab}
          onChange={setTab}
          items={TABS.map((id) => ({ id, label: PROGRAMS[id].name }))}
        />
        <div className={s.box} role="tabpanel" id={`home-tab-panel-${tab}`} aria-labelledby={`home-tab-${tab}`}>
          <div className={s.boxHead}>
            <h3>{PROGRAM_COPY[tab].title}</h3>
            <p>{PROGRAM_COPY[tab].text}</p>
            <LinkButton href={routes.catalog({ program: tab })} variant="outline" size="sm">
              Xem các khoá {PROGRAMS[tab].name}
            </LinkButton>
          </div>
          <CourseGrid courses={courses ? inTab : null} error={error} empty={`Chưa có khoá ${PROGRAMS[tab].name} nào.`} />
        </div>
      </section>

      <section className={s.wrap} aria-labelledby="goals-title">
        <div className={s.sectionHead}>
          <h2 id="goals-title">Học theo mục tiêu</h2>
        </div>
        <div className={s.goals}>
          {GOALS.map((g) => (
            <Link key={g.program} href={routes.catalog({ program: g.program })} className={s.goal}>
              <span className={s.goalImg}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/images/stock/${g.img}`} alt={g.alt} loading="lazy" />
                <span className={s.goalTag} style={{ background: PROGRAMS[g.program].color }}>
                  {PROGRAMS[g.program].name}
                </span>
              </span>
              <span>{g.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={s.band} aria-labelledby="why-title">
        <div className={s.wrap}>
          <h2 id="why-title" className="sr-only">
            Vì sao học trên Vân Kính
          </h2>
          <div className={s.bandImg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/stock/hutong.jpg" alt="Một con phố hutong ở Bắc Kinh với đèn lồng đỏ" loading="lazy" />
          </div>
          <div className={s.why}>
            <div>
              <h3>Học thử trước, trả tiền sau</h3>
              <p>Xem bài học thử miễn phí của khoá. Chỉ mua khi thấy hợp cách dạy.</p>
            </div>
            <div>
              <h3>Thanh toán bằng QR ngân hàng</h3>
              <p>Quét VietQR qua PayOS, khoá học mở ngay khi chuyển khoản thành công.</p>
            </div>
            <div>
              <h3>Ôn tập ngay trong bài</h3>
              <p>Flashcard, quiz và luyện viết chữ Hán đi kèm từ vựng của từng bài giảng.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={s.wrap} aria-labelledby="latest-title">
        <div className={s.sectionHead}>
          <h2 id="latest-title">Khoá học mới nhất</h2>
        </div>
        <CourseGrid courses={courses ? latest : null} error={error} empty="Chưa có khoá học nào." />
      </section>

      <section className={s.wrap} aria-labelledby="teach-title">
        <div className={s.teach}>
          <div>
            <h2 id="teach-title">Bạn là giáo viên tiếng Trung?</h2>
            <p>
              Đăng bài giảng, tài liệu, từ vựng và cấp quyền cho học viên của bạn.
              {SUPPORT_CONTACT ? ` Liên hệ ${SUPPORT_CONTACT} để mở tài khoản giáo viên.` : ''}
            </p>
          </div>
          <LinkButton
            href={user?.role === 'TEACHER' || user?.role === 'ADMIN' ? '/teacher' : routes.login('/teacher')}
            variant="outline"
            className={s.teachButton}
          >
            Vào khu giáo viên
          </LinkButton>
        </div>
      </section>
    </div>
  );
}

/** Shown to logged-in students right under the hero: courses in progress, latest first. */
function ContinueLearning({ userId }: { userId: string }) {
  const [items, setItems] = useState<MyCourseProgress[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    apiRequest<MyCourseProgress[]>('/progress/me')
      .then((data) => {
        if (cancelled) return;
        const open = data.filter((p) => p.totalLessons > 0 && p.completedCount < p.totalLessons);
        open.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
        setItems(open.slice(0, 3));
      })
      // The block is a shortcut; if progress cannot load, the rest of the home page still works.
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!items || items.length === 0) return null;

  return (
    <section className={s.wrap} aria-labelledby="continue-title">
      <div className={s.continueHead}>
        <h2 id="continue-title">Học tiếp</h2>
        <Link href={routes.myCourses}>Khoá học của tôi</Link>
      </div>
      <ul className={s.continueList}>
        {items.map((p) => {
          const percent = Math.round((p.completedCount / p.totalLessons) * 100);
          return (
            <li key={p.courseId}>
              {/* /learn/:courseId picks the lesson left half-way, or the next unfinished one. */}
              <Link href={routes.learn(p.courseId)} className={s.continueItem}>
                <span className={s.continueCover} style={{ background: PROGRAMS[p.module].color }} aria-hidden="true">
                  <span className="han">{PROGRAMS[p.module].han}</span>
                </span>
                <span className={s.continueText}>
                  <b>
                    {p.courseTitle} ·{' '}
                    {p.lastLesson.completed ? `Vừa học xong: ${p.lastLesson.title}` : p.lastLesson.title}
                  </b>
                  <ProgressBar value={percent} label={`Đã học ${percent}%`} />
                  <span className={s.continueMeta}>
                    {p.completedCount} / {p.totalLessons} bài
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CourseGrid({ courses, error, empty }: { courses: CourseItem[] | null; error: string; empty: string }) {
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!courses) {
    return (
      <div className={s.grid5} aria-busy="true" aria-label="Đang tải khoá học">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height="auto" style={{ aspectRatio: '16 / 9' }} />
            <Skeleton width="85%" height={18} />
            <Skeleton width="50%" />
          </div>
        ))}
      </div>
    );
  }
  if (courses.length === 0) return <EmptyState title={empty} />;
  return (
    <div className={s.grid5}>
      {courses.map((c) => (
        <CourseCard
          key={c.id}
          href={routes.course(c.id)}
          title={c.title}
          program={c.module}
          teacherName={c.teacher?.fullName}
          coverUrl={c.coverUrl ? buildMediaUrl(c.coverUrl) : null}
          isFree={c.isFree}
          priceVnd={isOnSale(c) ? c.priceVnd : null}
          ratingValue={c.rating?.value}
          ratingSource={c.rating?.source}
          meta={[courseMeta(c), learnerText(c.learnerCount ?? 0, c.offlineLearnerCount)].filter(Boolean).join(' · ')}
        />
      ))}
    </div>
  );
}
