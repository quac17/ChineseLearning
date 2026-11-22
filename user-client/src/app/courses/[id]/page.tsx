'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { FileIcon, LockIcon, PlayIcon } from '@/components/course/icons';
import { useCourse } from '@/components/course/useCourse';
import { useAuth } from '@/context/AuthContext';
import { buildMediaUrl, formatFileSize } from '@/lib/api';
import { BuyButton } from '@/components/course/BuyButton';
import {
  LEVELS,
  courseOutline,
  firstLesson,
  formatMinutes,
  hasSections,
  isOnSale,
  lessonDuration,
  lessonsMinutes,
  previewLesson,
  routes,
  sectionHeading,
  sortedLessons,
  type OutlineGroup,
} from '@/lib/courses';
import { PROGRAMS, formatVnd } from '@/lib/programs';
import { REFUND_POLICY } from '@/lib/site';
import type { CourseItem, LessonItem } from '@/lib/types';
import s from './course.module.css';

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { course, error } = useCourse(id);

  if (error) {
    return (
      <div className={`${s.wrap} ${s.state}`}>
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
    );
  }

  if (!course) return <CourseSkeleton />;
  return <CourseDetail course={course} />;
}

function CourseDetail({ course }: { course: CourseItem }) {
  const p = PROGRAMS[course.module];
  const lessons = sortedLessons(course);
  const hasDocs = course.documents.length > 0;

  return (
    <>
      <section className={s.hero}>
        <div className={`${s.wrap} ${s.heroInner}`}>
          <div className={`${s.col} ${s.heroText}`}>
            <p className={s.crumbs}>
              <Link href={routes.catalog()}>Khoá học</Link> ›{' '}
              <Link href={routes.catalog({ program: course.module })}>{p.name}</Link>
            </p>
            <h1 className={s.title}>{course.title}</h1>
            {course.subtitle ? (
              <p className={s.lead}>{course.subtitle}</p>
            ) : (
              course.description && <p className={s.lead}>{firstSentence(course.description)}</p>
            )}
            <p className={s.heroMeta}>
              {course.isFree && <Badge tone="new">Miễn phí</Badge>}
              {course.level && <span>{LEVELS[course.level].label}</span>}
              {!course.isFree && course.hasAccess && <Badge tone="owned">Bạn đã có quyền xem</Badge>}
              <span>
                {lessons.length} bài{hasDocs ? ` · ${course.documents.length} tài liệu` : ''}
              </span>
            </p>
            {course.teacher && (
              <p className={s.heroMeta}>
                <span>
                  Giáo viên: <a href="#giao-vien">{course.teacher.fullName}</a>
                </span>
              </p>
            )}
          </div>
          <BuyBox course={course} />
        </div>
      </section>
      <MobileBuyBar course={course} />

      <div className={`${s.wrap} ${s.body}`}>
        <div className={`${s.col} ${s.sections}`}>
          {(course.outcomes?.length ?? 0) > 0 && (
            <section className={`${s.section} ${s.learnBox}`} aria-labelledby="hoc-duoc">
              <h2 id="hoc-duoc">Bạn sẽ học được</h2>
              <ul className={s.learn}>
                {course.outcomes!.map((item) => (
                  <li key={item}>
                    <span className={s.check} aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={s.section} aria-labelledby="noi-dung">
            <h2 id="noi-dung">Nội dung khoá học</h2>
            <p className={s.sub}>{outlineSummary(course)}</p>
            {lessons.length === 0 && !hasSections(course) ? (
              <EmptyState title="Khoá học chưa có bài giảng">Giáo viên đang chuẩn bị nội dung. Quay lại sau nhé.</EmptyState>
            ) : hasSections(course) ? (
              <SectionedOutline course={course} />
            ) : (
              <div className={s.outline}>
                <div className={s.outlineHead}>
                  <span>Bài giảng</span>
                  <span>{lessons.length} bài</span>
                </div>
                <ol className={s.lessons}>
                  {lessons.map((lesson, i) => (
                    <LessonRow key={lesson.id} course={course} lesson={lesson} index={i} />
                  ))}
                </ol>
              </div>
            )}
          </section>

          {hasDocs && (
            <section className={s.section} aria-labelledby="tai-lieu">
              <h2 id="tai-lieu">Tài liệu</h2>
              <ul className={s.docs}>
                {course.documents.map((doc) => (
                  <li key={doc.id} className={s.doc}>
                    <span className={s.lessonTitle}>
                      <span className={s.icon}>
                        <FileIcon size={18} />
                      </span>
                      <span className={s.docName}>
                        <b>{doc.title}</b>
                        <span>
                          .{doc.fileType.toUpperCase()} · {formatFileSize(doc.fileSize)}
                          {doc.isFree && !course.hasAccess ? ' · Miễn phí' : ''}
                        </span>
                      </span>
                    </span>
                    {doc.canDownload && doc.downloadPath ? (
                      <LinkButton href={buildMediaUrl(doc.downloadPath)} variant="outline" size="sm" download>
                        Tải về
                      </LinkButton>
                    ) : (
                      <span className={s.lessonSide}>
                        <LockIcon />
                        <span>Đã khoá</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {course.description && (
            <section className={s.section} aria-labelledby="mo-ta">
              <h2 id="mo-ta">Mô tả</h2>
              <p className={s.description}>{course.description}</p>
            </section>
          )}

          {course.teacher && (
            <section className={s.section} aria-labelledby="giao-vien">
              <h2 id="giao-vien">Giáo viên</h2>
              <div className={s.teacher}>
                <span className={s.avatar} aria-hidden="true">
                  {course.teacher.fullName.trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <span className={s.teacherName}>{course.teacher.fullName}</span>
                  {course.teacher.bio && <p className={s.teacherBio}>{course.teacher.bio}</p>}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

/** "2 phần · 5 bài" (sections only when the course has them). */
function outlineSummary(course: CourseItem): string {
  const parts = [];
  if (hasSections(course)) parts.push(`${course.sections!.length} phần`);
  parts.push(`${course.lessons.length} bài`);
  if (course.totalDurationMinutes) parts.push(`tổng ${formatMinutes(course.totalDurationMinutes)}`);
  return parts.join(' · ');
}

/** One accordion per section; the first one starts open. Numbering runs across sections. */
function SectionedOutline({ course }: { course: CourseItem }) {
  const groups = courseOutline(course);
  let offset = 0;
  return (
    <div className={s.outline}>
      {groups.map((group, gi) => {
        const start = offset;
        offset += group.lessons.length;
        return <SectionBlock key={group.section?.id ?? 'rest'} course={course} group={group} start={start} open={gi === 0} />;
      })}
    </div>
  );
}

function SectionBlock({
  course,
  group,
  start,
  open,
}: {
  course: CourseItem;
  group: OutlineGroup;
  start: number;
  open: boolean;
}) {
  return (
    <details className={s.part} open={open}>
      <summary className={s.partHead}>
        <span className={s.partTitle}>
          <ChevronIcon />
          {sectionHeading(group)}
        </span>
        <span className={s.partMeta}>
          {group.lessons.length} bài
          {lessonsMinutes(group.lessons) > 0 && ` · ${formatMinutes(lessonsMinutes(group.lessons))}`}
        </span>
      </summary>
      {group.lessons.length === 0 ? (
        <p className={s.partEmpty}>Phần này chưa có bài giảng.</p>
      ) : (
        <ol className={s.lessons} start={start + 1}>
          {group.lessons.map((lesson, i) => (
            <LessonRow key={lesson.id} course={course} lesson={lesson} index={start + i} />
          ))}
        </ol>
      )}
    </details>
  );
}

function ChevronIcon() {
  return (
    <svg className={s.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LessonRow({ course, lesson, index }: { course: CourseItem; lesson: LessonItem; index: number }) {
  const title = `${index + 1}. ${lesson.title}`;
  const duration = lessonDuration(lesson);
  const isPreview = lesson.isFree && !course.hasAccess;
  return (
    <li className={s.lesson}>
      <span className={s.lessonTitle}>
        <span className={s.icon}>{lesson.canWatch ? <PlayIcon /> : <LockIcon />}</span>
        {lesson.canWatch && !isPreview ? <Link href={routes.learn(course.id, lesson.id)}>{title}</Link> : <span>{title}</span>}
      </span>
      <span className={s.lessonSide}>
        {isPreview && (
          <Link href={routes.learn(course.id, lesson.id)} className={s.previewLink}>
            Xem thử
          </Link>
        )}
        {!lesson.canWatch && <span className="sr-only">Đã khoá</span>}
        {duration && <span>{duration}</span>}
      </span>
    </li>
  );
}

/** The buy box: price + QR checkout when on sale, otherwise how to get access. */
function BuyBox({ course }: { course: CourseItem }) {
  const { user } = useAuth();
  const p = PROGRAMS[course.module];
  const start = firstLesson(course);
  const preview = previewLesson(course);
  const previewTarget = course.hasAccess ? start : preview;

  return (
    <aside className={s.buy} aria-label={course.hasAccess ? 'Vào học' : 'Mở khoá khoá học'}>
      {previewTarget?.canWatch ? (
        <Link href={routes.learn(course.id, previewTarget.id)} className={s.preview} style={{ background: p.color }}>
          {course.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={buildMediaUrl(course.coverUrl)} alt="" className={s.coverImg} />
          )}
          <span className={s.play}>
            <PlayIcon size={22} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {course.hasAccess ? 'Bắt đầu học' : 'Xem trước khoá học'}
          </span>
        </Link>
      ) : (
        <div className={s.preview} style={{ background: p.color }} aria-hidden="true">
          {course.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={buildMediaUrl(course.coverUrl)} alt="" className={s.coverImg} />
          ) : (
            <span className={s.previewHan}>{p.han}</span>
          )}
        </div>
      )}
      <div className={s.buyBody}>
        {course.hasAccess ? (
          <>
            <p className={s.price}>{course.isFree ? 'Miễn phí' : 'Đã mở khoá'}</p>
            {start ? (
              <LinkButton href={routes.learn(course.id, start.id)} variant="ink" block>
                Vào học
              </LinkButton>
            ) : (
              <p className={s.note}>Khoá học chưa có bài giảng.</p>
            )}
          </>
        ) : isOnSale(course) ? (
          <>
            <p className={s.price}>{formatVnd(course.priceVnd!)}</p>
            <BuyButton courseId={course.id} block />
            {preview && (
              <LinkButton href={routes.learn(course.id, preview.id)} variant="outline" block>
                Xem bài học thử
              </LinkButton>
            )}
            {REFUND_POLICY && <p className={s.note} style={{ textAlign: 'center' }}>{REFUND_POLICY}</p>}
            {!user && (
              <p className={s.note} style={{ textAlign: 'center' }}>
                Đã mua rồi? <Link href={routes.login(routes.course(course.id))}>Đăng nhập</Link> để vào học.
              </p>
            )}
          </>
        ) : (
          <>
            <p className={s.price}>Chưa mở bán</p>
            <p className={s.note}>
              {user
                ? 'Khoá học này chưa mở bán trực tuyến. Liên hệ giáo viên phụ trách để được mở khoá cho tài khoản của bạn.'
                : 'Đã được mở khoá? Đăng nhập để vào học.'}
            </p>
            {!user && (
              <LinkButton href={routes.login(routes.course(course.id))} variant="ink" block>
                Đăng nhập
              </LinkButton>
            )}
            {preview && (
              <LinkButton href={routes.learn(course.id, preview.id)} variant="outline" block>
                Xem bài học thử
              </LinkButton>
            )}
          </>
        )}
        <p className={s.includes}>Khoá học gồm</p>
        <ul className={s.includeList}>
          <li>
            {course.lessons.length} bài giảng video
            {course.totalDurationMinutes ? ` (${formatMinutes(course.totalDurationMinutes)})` : ''}
          </li>
          {course.documents.length > 0 && <li>{course.documents.length} tài liệu Word / PowerPoint</li>}
          <li>Xem trên web và điện thoại</li>
        </ul>
      </div>
    </aside>
  );
}

/**
 * Phone-width bar fixed above the tab bar (docs/design/canvas/AppCourse.dc.html):
 * price + "Mua bằng QR", or "Vào học" once the learner has access. Not shown
 * when the course is not on sale. Hidden by CSS above 760px.
 */
function MobileBuyBar({ course }: { course: CourseItem }) {
  const start = firstLesson(course);
  if (course.hasAccess) {
    if (!start) return null;
    return (
      <div className={s.buyBar} data-testid="mobile-buy-bar">
        <span className={s.barPrice}>{course.isFree ? 'Miễn phí' : 'Đã mở khoá'}</span>
        <LinkButton href={routes.learn(course.id, start.id)} variant="ink" className={s.barAction}>
          Vào học
        </LinkButton>
      </div>
    );
  }
  if (!isOnSale(course)) return null;
  return (
    <div className={s.buyBar} data-testid="mobile-buy-bar">
      <span className={s.barPrice}>{formatVnd(course.priceVnd!)}</span>
      <BuyButton courseId={course.id} label="Mua bằng QR" className={s.barAction} />
    </div>
  );
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^.+?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

function CourseSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải khoá học">
      <section className={s.hero}>
        <div className={`${s.wrap} ${s.heroInner}`}>
          <div className={`${s.col} ${s.heroText}`}>
            <Skeleton width={160} height={14} style={{ opacity: 0.3 }} />
            <Skeleton width="80%" height={36} style={{ opacity: 0.3 }} />
            <Skeleton width="60%" height={20} style={{ opacity: 0.3 }} />
          </div>
        </div>
      </section>
      <div className={`${s.wrap} ${s.body}`}>
        <div className={s.col}>
          <Skeleton height={200} />
        </div>
      </div>
    </div>
  );
}
