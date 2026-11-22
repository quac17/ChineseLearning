'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, LinkButton, Logo, Skeleton, Tabs } from '@/components/ui';
import { FileIcon, LockIcon, PlayIcon } from '@/components/course/icons';
import { useCourse } from '@/components/course/useCourse';
import { useAuth } from '@/context/AuthContext';
import { buildMediaUrl, formatFileSize } from '@/lib/api';
import { BuyButton } from '@/components/course/BuyButton';
import { isOnSale, lessonDuration, previewLesson, routes, sortedLessons } from '@/lib/courses';
import { formatVnd } from '@/lib/programs';
import type { CourseItem, LessonItem } from '@/lib/types';
import s from '../../player.module.css';

type TabId = 'overview' | 'docs';

export default function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { course, error } = useCourse(courseId);

  if (error) {
    return (
      <>
        <TopBar />
        <div className={s.state}>
          <EmptyState
            title="Không tìm thấy khoá học"
            action={
              <LinkButton href={routes.catalog()} variant="outline">
                Xem tất cả khoá học
              </LinkButton>
            }
          >
            {error}
          </EmptyState>
        </div>
      </>
    );
  }

  if (!course) {
    return (
      <>
        <TopBar />
        <div aria-busy="true" aria-label="Đang tải bài học">
          <Skeleton height="auto" style={{ aspectRatio: '16 / 9', borderRadius: 0 }} />
        </div>
      </>
    );
  }

  const lessons = sortedLessons(course);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) {
    return (
      <>
        <TopBar course={course} />
        <div className={s.state}>
          <EmptyState
            title="Không tìm thấy bài học"
            action={
              <LinkButton href={routes.course(course.id)} variant="outline">
                Về trang khoá học
              </LinkButton>
            }
          >
            Bài học này không còn trong khoá học hoặc đường dẫn không đúng.
          </EmptyState>
        </div>
      </>
    );
  }

  return <Player course={course} lessons={lessons} index={index} />;
}

function TopBar({ course, position }: { course?: CourseItem; position?: string }) {
  return (
    <header className={s.top}>
      <Logo variant="icon" height={30} onDark />
      <span className={s.sep} aria-hidden="true" />
      {course ? (
        <Link href={routes.course(course.id)} className={s.courseTitle}>
          {course.title}
        </Link>
      ) : (
        <span className={s.courseTitle} />
      )}
      {position && <span className={s.position}>{position}</span>}
    </header>
  );
}

function Player({ course, lessons, index }: { course: CourseItem; lessons: LessonItem[]; index: number }) {
  const [tab, setTab] = useState<TabId>('overview');
  const lesson = lessons[index];
  const prev = lessons[index - 1];
  const next = lessons[index + 1];

  return (
    <>
      <TopBar course={course} position={`Bài ${index + 1} / ${lessons.length}`} />
      <div className={s.layout}>
        <main className={s.main}>
          <Stage course={course} lesson={lesson} />
          <div className={s.content}>
            {/* Teachers usually number titles themselves ("Bài 2: …"), so no prefix here. */}
            <h1 className={s.lessonTitle}>{lesson.title}</h1>
            <Tabs<TabId>
              label="Nội dung bài"
              idPrefix="lesson-tab"
              value={tab}
              onChange={setTab}
              items={[
                { id: 'overview', label: 'Tổng quan' },
                { id: 'docs', label: `Tài liệu (${course.documents.length})` },
              ]}
            />
            <div
              className={s.tabPanel}
              role="tabpanel"
              id={`lesson-tab-panel-${tab}`}
              aria-labelledby={`lesson-tab-${tab}`}
              tabIndex={0}
            >
              {tab === 'overview' ? (
                <p>{lesson.description?.trim() || 'Bài học này chưa có mô tả.'}</p>
              ) : (
                <Documents course={course} />
              )}
            </div>
            <nav className={s.nav} aria-label="Chuyển bài">
              {prev ? (
                <LinkButton href={routes.learn(course.id, prev.id)} variant="outline" size="sm">
                  ‹ Bài trước
                </LinkButton>
              ) : (
                <span />
              )}
              {next && (
                <LinkButton href={routes.learn(course.id, next.id)} variant="ink" size="sm">
                  Bài tiếp theo ›
                </LinkButton>
              )}
            </nav>
          </div>
        </main>
        <aside className={s.side} aria-label="Nội dung khoá học">
          <h2 className={s.sideHead}>Nội dung khoá học</h2>
          <div className={s.sideSub}>{lessons.length} bài giảng</div>
          <ol className={s.items}>
            {lessons.map((l, i) => {
              const label = `${i + 1}. ${l.title}`;
              const meta = [lessonDuration(l), i === index ? 'đang xem' : '', !l.canWatch ? 'đã khoá' : '']
                .filter(Boolean)
                .join(' · ');
              const inner = (
                <>
                  <span className={s.itemIcon}>{l.canWatch ? <PlayIcon size={14} /> : <LockIcon size={14} />}</span>
                  <span className={s.itemText}>
                    <span>{label}</span>
                    {meta && <span className={s.itemMeta}>{meta}</span>}
                  </span>
                </>
              );
              return (
                <li key={l.id}>
                  <Link
                    href={routes.learn(course.id, l.id)}
                    className={s.item}
                    aria-current={i === index ? 'page' : undefined}
                  >
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </>
  );
}

/** The video, or the locked state with what to do next. Never renders a URL for a locked lesson. */
function Stage({ course, lesson }: { course: CourseItem; lesson: LessonItem }) {
  const { user } = useAuth();

  if (!lesson.canWatch) {
    const preview = previewLesson(course);
    const onSale = isOnSale(course);
    const here = routes.learn(course.id, lesson.id);
    return (
      <div className={s.stage}>
        <div className={s.locked}>
          <LockIcon size={40} />
          <h2>Bài học này đã khoá</h2>
          <p>
            {onSale
              ? `Mua khoá học (${formatVnd(course.priceVnd!)}) bằng mã QR để mở toàn bộ bài giảng.`
              : user
                ? 'Khoá học này chưa mở bán trực tuyến. Liên hệ giáo viên phụ trách để được mở khoá.'
                : 'Đăng nhập nếu bạn đã được mở khoá khoá học này, hoặc xem bài học thử miễn phí.'}
          </p>
          <div className={s.lockedActions}>
            {onSale && <BuyButton courseId={course.id} size="sm" label="Mua khoá học" />}
            {!user && (
              <LinkButton
                href={routes.login(here)}
                variant={onSale ? 'outline' : 'accent'}
                size="sm"
                className={onSale ? s.onDark : undefined}
              >
                Đăng nhập
              </LinkButton>
            )}
            {preview && preview.id !== lesson.id && (
              <LinkButton href={routes.learn(course.id, preview.id)} variant="outline" size="sm" className={s.onDark}>
                Xem bài học thử
              </LinkButton>
            )}
            <LinkButton href={routes.course(course.id)} variant="outline" size="sm" className={s.onDark}>
              Về trang khoá học
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  if (lesson.sourceType === 'YOUTUBE' && lesson.youtubeId) {
    return (
      <div className={s.stage}>
        <iframe
          key={lesson.id}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(lesson.youtubeId)}?rel=0`}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (lesson.sourceType === 'UPLOAD' && lesson.streamPath) {
    const src = buildMediaUrl(lesson.streamPath);
    return (
      <div className={s.stage}>
        <video key={src} controls controlsList="nodownload" preload="metadata" src={src}>
          Trình duyệt của bạn không hỗ trợ phát video.
        </video>
      </div>
    );
  }

  return (
    <div className={s.stage}>
      <div className={s.locked}>
        <h2>Video chưa sẵn sàng</h2>
        <p>Giáo viên chưa tải video cho bài này.</p>
      </div>
    </div>
  );
}

function Documents({ course }: { course: CourseItem }) {
  if (course.documents.length === 0) {
    return <p className={s.muted}>Khoá học này chưa có tài liệu.</p>;
  }
  return (
    <ul className={s.docs}>
      {course.documents.map((doc) => (
        <li key={doc.id} className={s.doc}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
            <span className={s.muted}>
              <FileIcon size={18} />
            </span>
            <span>
              {doc.title}
              <span className={s.muted}>
                {' '}
                · .{doc.fileType.toUpperCase()} · {formatFileSize(doc.fileSize)}
              </span>
            </span>
          </span>
          {doc.canDownload && doc.downloadPath ? (
            <LinkButton href={buildMediaUrl(doc.downloadPath)} variant="outline" size="sm" download>
              Tải về
            </LinkButton>
          ) : (
            <span className={s.muted} style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <LockIcon /> Đã khoá
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
