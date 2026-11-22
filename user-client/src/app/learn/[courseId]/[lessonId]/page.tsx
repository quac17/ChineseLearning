'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, LinkButton, Logo, Skeleton, Tabs, useToast } from '@/components/ui';
import { FileIcon, LockIcon, PlayIcon } from '@/components/course/icons';
import { useCourse } from '@/components/course/useCourse';
import { useCourseProgress } from '@/components/course/useCourseProgress';
import { VocabularyList } from '@/components/course/VocabularyList';
import { useAuth } from '@/context/AuthContext';
import { buildMediaUrl, formatFileSize } from '@/lib/api';
import { BuyButton } from '@/components/course/BuyButton';
import { isOnSale, lessonDuration, previewLesson, routes, sortedLessons } from '@/lib/courses';
import { formatVnd } from '@/lib/programs';
import { PHONE_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import type { CourseItem, LessonItem } from '@/lib/types';
import s from '../../player.module.css';

type TabId = 'vocab' | 'overview' | 'docs';
/** Phone tabs (docs/design/canvas/AppPlayer.dc.html). */
type PhoneTabId = 'lessons' | 'study';

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
  const lesson0 = lessons[index];
  const hasVocab = lesson0.canWatch && (lesson0.vocabularyCount ?? 0) > 0;
  // Words first when the lesson has them (the design opens on "Từ vựng").
  const [tab, setTab] = useState<TabId>(hasVocab ? 'vocab' : 'overview');
  // Moving to another lesson reuses this component: reset the tab for it.
  useEffect(() => setTab(hasVocab ? 'vocab' : 'overview'), [lesson0.id, hasVocab]);
  const [phoneTab, setPhoneTab] = useState<PhoneTabId>('lessons');
  const phone = useMediaQuery(PHONE_QUERY);
  const toast = useToast();
  const { progress, save, byLesson, enabled: tracking } = useCourseProgress(course.id);
  const lesson = lessons[index];
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const done = (id: string) => Boolean(byLesson(id)?.completed);
  const watchable = lessons.filter((l) => l.canWatch);
  const doneCount = watchable.filter((l) => done(l.id)).length;

  const toggle = async (id: string, completed: boolean) => {
    try {
      await save(id, { completed });
    } catch (err) {
      toast.show((err as Error).message || 'Không lưu được tiến độ.');
    }
  };

  const curriculum = { course, lessons, index, tracking, done, toggle };
  const summary = tracking && progress ? `${doneCount} / ${watchable.length} bài đã học` : `${lessons.length} bài giảng`;

  const position = tracking && progress
    ? `Bài ${index + 1} / ${lessons.length} · Đã học ${doneCount} / ${watchable.length}`
    : `Bài ${index + 1} / ${lessons.length}`;

  return (
    <>
      <TopBar course={course} position={position} />
      <div className={s.layout}>
        <main className={s.main}>
          <Stage
            course={course}
            lesson={lesson}
            resumeAt={done(lesson.id) ? 0 : byLesson(lesson.id)?.positionSeconds ?? 0}
            onVideoProgress={tracking ? (p) => save(lesson.id, p).catch(() => undefined) : undefined}
          />
          <div className={s.content}>
            <div className={s.titleRow}>
              {/* Teachers usually number titles themselves ("Bài 2: …"), so no prefix here. */}
              <h1 className={s.lessonTitle}>{lesson.title}</h1>
              {tracking && lesson.canWatch && (
                <Button
                  variant={done(lesson.id) ? 'subtle' : 'outline'}
                  size="sm"
                  aria-pressed={done(lesson.id)}
                  onClick={() => toggle(lesson.id, !done(lesson.id))}
                >
                  {done(lesson.id) ? '✓ Đã học' : 'Đánh dấu đã học'}
                </Button>
              )}
            </div>
            {phone ? (
              <>
                <div className={s.phoneTabs}>
                  <Tabs<PhoneTabId>
                    label="Nội dung bài"
                    idPrefix="phone-tab"
                    value={phoneTab}
                    onChange={setPhoneTab}
                    items={[
                      { id: 'lessons', label: 'Bài giảng' },
                      { id: 'study', label: 'Từ vựng & tài liệu' },
                    ]}
                  />
                </div>
                <div
                  className={s.tabPanel}
                  role="tabpanel"
                  id={`phone-tab-panel-${phoneTab}`}
                  aria-labelledby={`phone-tab-${phoneTab}`}
                  tabIndex={0}
                >
                  {phoneTab === 'lessons' ? (
                    <div className={s.phoneList}>
                      <div className={s.sideSub}>{summary}</div>
                      <Curriculum {...curriculum} />
                    </div>
                  ) : (
                    <div className={s.study}>
                      {lesson.description?.trim() && <p>{lesson.description.trim()}</p>}
                      {hasVocab && (
                        <section aria-labelledby="study-vocab">
                          <h2 id="study-vocab" className={s.studyHead}>
                            Từ vựng ({lesson.vocabularyCount})
                          </h2>
                          <VocabularyList lessonId={lesson.id} />
                        </section>
                      )}
                      <section aria-labelledby="study-docs">
                        <h2 id="study-docs" className={s.studyHead}>
                          Tài liệu ({course.documents.length})
                        </h2>
                        <Documents course={course} />
                      </section>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Tabs<TabId>
                  label="Nội dung bài"
                  idPrefix="lesson-tab"
                  value={tab}
                  onChange={setTab}
                  items={[
                    ...(hasVocab ? [{ id: 'vocab' as const, label: `Từ vựng (${lesson.vocabularyCount})` }] : []),
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
                  {tab === 'vocab' && hasVocab ? (
                    <VocabularyList lessonId={lesson.id} />
                  ) : tab === 'docs' ? (
                    <Documents course={course} />
                  ) : (
                    <p>{lesson.description?.trim() || 'Bài học này chưa có mô tả.'}</p>
                  )}
                </div>
              </>
            )}
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
        {!phone && (
          <aside className={s.side} aria-label="Nội dung khoá học">
            <h2 className={s.sideHead}>Nội dung khoá học</h2>
            <div className={s.sideSub}>{summary}</div>
            <Curriculum {...curriculum} />
          </aside>
        )}
      </div>
    </>
  );
}

/** Lesson list with completion ticks: the desktop sidebar and the phone "Bài giảng" tab. */
function Curriculum({
  course,
  lessons,
  index,
  tracking,
  done,
  toggle,
}: {
  course: CourseItem;
  lessons: LessonItem[];
  index: number;
  tracking: boolean;
  done: (id: string) => boolean;
  toggle: (id: string, completed: boolean) => void;
}) {
  return (
    <ol className={s.items}>
      {lessons.map((l, i) => {
        const label = `${i + 1}. ${l.title}`;
        const meta = [lessonDuration(l), i === index ? 'đang xem' : '', !l.canWatch ? 'đã khoá' : '']
          .filter(Boolean)
          .join(' · ');
        const showTick = tracking && l.canWatch;
        return (
          <li key={l.id} className={s.itemRow} data-current={i === index || undefined}>
            {showTick ? (
              <input
                type="checkbox"
                className={s.tick}
                checked={done(l.id)}
                onChange={(e) => toggle(l.id, e.target.checked)}
                aria-label={`Đã học: ${label}`}
              />
            ) : (
              <span className={s.itemIcon}>{l.canWatch ? <PlayIcon size={14} /> : <LockIcon size={14} />}</span>
            )}
            <Link
              href={routes.learn(course.id, l.id)}
              className={s.item}
              aria-current={i === index ? 'page' : undefined}
            >
              <span className={s.itemText}>
                <span>{label}</span>
                {meta && <span className={s.itemMeta}>{meta}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** The video, or the locked state with what to do next. Never renders a URL for a locked lesson. */
function Stage({
  course,
  lesson,
  resumeAt = 0,
  onVideoProgress,
}: {
  course: CourseItem;
  lesson: LessonItem;
  /** Seconds to resume an uploaded video from (0 = start). */
  resumeAt?: number;
  /** Called with the position of an uploaded video (throttled, plus on pause/end). */
  onVideoProgress?: (p: { positionSeconds: number; durationSeconds: number }) => void;
}) {
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
      <div className={`${s.stage} ${s.stagePlaying}`}>
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
    return (
      <div className={`${s.stage} ${s.stagePlaying}`}>
        <UploadedVideo
          key={lesson.id}
          src={buildMediaUrl(lesson.streamPath)}
          resumeAt={resumeAt}
          onProgress={onVideoProgress}
        />
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

/** How often a playing video reports its position to the server. */
const SAVE_EVERY_S = 15;

function UploadedVideo({
  src,
  resumeAt,
  onProgress,
}: {
  src: string;
  resumeAt: number;
  onProgress?: (p: { positionSeconds: number; durationSeconds: number }) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const resumed = useRef(false);

  const report = (force: boolean, ended = false) => {
    const v = ref.current;
    if (!v || !onProgress || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const duration = Math.max(1, Math.round(v.duration));
    // At the end, report the full length: rounding 3.97 s down would miss 90%.
    const pos = ended ? duration : Math.round(v.currentTime);
    if (!force && Math.abs(pos - lastSaved.current) < SAVE_EVERY_S) return;
    lastSaved.current = pos;
    onProgress({ positionSeconds: pos, durationSeconds: duration });
  };

  // Resume where the learner stopped, unless that is the very start or end.
  const resume = () => {
    const v = ref.current;
    if (!v || resumed.current) return;
    resumed.current = true;
    if (resumeAt > 5 && Number.isFinite(v.duration) && resumeAt < v.duration - 5) {
      v.currentTime = resumeAt;
      lastSaved.current = resumeAt;
    }
  };

  return (
    <video
      ref={ref}
      controls
      controlsList="nodownload"
      preload="metadata"
      src={src}
      onLoadedMetadata={resume}
      onTimeUpdate={() => report(false)}
      onPause={() => report(true)}
      onEnded={() => report(true, true)}
    >
      Trình duyệt của bạn không hỗ trợ phát video.
    </video>
  );
}
