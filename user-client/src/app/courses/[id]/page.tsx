'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, EmptyState, LinkButton, Skeleton } from '@/components/ui';
import { FileIcon, LockIcon, PlayIcon } from '@/components/course/icons';
import { useCourse } from '@/components/course/useCourse';
import { useAuth } from '@/context/AuthContext';
import { buildMediaUrl, formatFileSize } from '@/lib/api';
import { BuyButton } from '@/components/course/BuyButton';
import { firstLesson, isOnSale, lessonDuration, previewLesson, routes, sortedLessons } from '@/lib/courses';
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
            {course.description && <p className={s.lead}>{firstSentence(course.description)}</p>}
            <p className={s.heroMeta}>
              {course.isFree && <Badge tone="new">Miễn phí</Badge>}
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

      <div className={`${s.wrap} ${s.body}`}>
        <div className={`${s.col} ${s.sections}`}>
          <section className={s.section} aria-labelledby="noi-dung">
            <h2 id="noi-dung">Nội dung khoá học</h2>
            <p className={s.sub}>{lessons.length} bài giảng video</p>
            {lessons.length === 0 ? (
              <EmptyState title="Khoá học chưa có bài giảng">Giáo viên đang chuẩn bị nội dung. Quay lại sau nhé.</EmptyState>
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
          <span className={s.play}>
            <PlayIcon size={22} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {course.hasAccess ? 'Bắt đầu học' : 'Xem trước khoá học'}
          </span>
        </Link>
      ) : (
        <div className={s.preview} style={{ background: p.color }} aria-hidden="true">
          <span className={s.previewHan}>{p.han}</span>
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
          <li>{course.lessons.length} bài giảng video</li>
          {course.documents.length > 0 && <li>{course.documents.length} tài liệu Word / PowerPoint</li>}
          <li>Xem trên web và điện thoại</li>
        </ul>
      </div>
    </aside>
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
