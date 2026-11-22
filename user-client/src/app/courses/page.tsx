'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useModule } from '@/context/ModuleContext';
import { apiRequest, buildMediaUrl, formatFileSize } from '@/lib/api';
import { getModuleName } from '@/lib/modules';
import { CourseItem, LessonItem } from '@/lib/types';
import { VideoPlayer } from '@/components/VideoPlayer';

function CoursesContent() {
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get('courseId');
  const { activeModule } = useModule();
  const { user } = useAuth();

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const qs = activeModule === 'all' ? '' : `?module=${activeModule}`;
    apiRequest<CourseItem[]>(`/courses${qs}`)
      .then((data) => {
        if (cancelled) return;
        setCourses(data);
        if (data.length > 0) {
          const matched =
            data.find((c) => c.id === (selectedCourseId || initialCourseId)) || data[0];
          setSelectedCourseId(matched.id);
          setSelectedLessonId(matched.lessons[0]?.id || '');
        } else {
          setSelectedCourseId('');
          setSelectedLessonId('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Không thể tải danh sách khóa học.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeModule, user?.id, initialCourseId]);

  const currentCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId],
  );

  const currentLesson: LessonItem | null = useMemo(() => {
    if (!currentCourse) return null;
    return (
      currentCourse.lessons.find((l) => l.id === selectedLessonId) ||
      currentCourse.lessons[0] ||
      null
    );
  }, [currentCourse, selectedLessonId]);

  const handleSelectCourse = (course: CourseItem) => {
    setSelectedCourseId(course.id);
    setSelectedLessonId(course.lessons[0]?.id || '');
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Khóa học, Video bài giảng & Tài liệu</h2>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p className="hint">Đang tải danh sách khóa học...</p>
      ) : courses.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Chưa có khóa học nào trong chương trình đang chọn.</p>
        </div>
      ) : (
        <div className="split-layout">
          {/* Course list sidebar */}
          <div className="lessons">
            {courses.map((course) => {
              const isSelected = currentCourse?.id === course.id;
              return (
                <button
                  key={course.id}
                  type="button"
                  className={`les ${isSelected ? 'active' : ''}`}
                  style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
                  onClick={() => handleSelectCourse(course)}
                >
                  <div className="t" style={{ minWidth: 0 }}>
                    <b>{course.title}</b>
                    <br />
                    <small>
                      {getModuleName(course.module)} · {course.lessons.length} video ·{' '}
                      {course.documents.length} tài liệu
                    </small>
                    <div style={{ marginTop: 6 }}>
                      <span className={`tag ${course.hasAccess ? 'free' : 'paid'}`}>
                        {course.isFree
                          ? 'Miễn phí'
                          : course.hasAccess
                          ? 'Đã mở khóa'
                          : 'Chưa cấp quyền'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Course Viewer */}
          {currentCourse && (
            <div>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 20 }}>{currentCourse.title}</h3>
                    <small style={{ color: 'var(--mute)' }}>
                      Chương trình: {getModuleName(currentCourse.module)} · Giáo viên:{' '}
                      {currentCourse.teacher?.fullName || 'Chinese Learner'}
                    </small>
                  </div>
                  <span className={`tag ${currentCourse.hasAccess ? 'free' : 'paid'}`}>
                    {currentCourse.isFree
                      ? 'Khóa miễn phí'
                      : currentCourse.hasAccess
                      ? 'Bạn đã có quyền xem'
                      : 'Khóa học có phân quyền'}
                  </span>
                </div>
                {currentCourse.description && (
                  <p style={{ margin: '10px 0 0', fontSize: 14 }}>{currentCourse.description}</p>
                )}
              </div>

              {/* Video Player */}
              {currentLesson && (
                <div style={{ marginBottom: 8 }}>
                  <b>{currentLesson.title}</b>
                  {currentLesson.duration && (
                    <span style={{ color: 'var(--mute)', fontSize: 13, marginLeft: 8 }}>
                      ({currentLesson.duration})
                    </span>
                  )}
                </div>
              )}

              <VideoPlayer lesson={currentLesson} isLoggedIn={Boolean(user)} />

              {currentLesson?.description && (
                <p className="hint" style={{ marginTop: 6 }}>
                  {currentLesson.description}
                </p>
              )}

              {/* Lesson Playlist */}
              <h3>Danh sách bài giảng video ({currentCourse.lessons.length})</h3>
              {currentCourse.lessons.length === 0 ? (
                <p className="hint">Khóa học này chưa có video bài giảng.</p>
              ) : (
                <div className="lessons" style={{ marginBottom: 22 }}>
                  {currentCourse.lessons.map((lesson, idx) => (
                    <div
                      key={lesson.id}
                      className={`les ${currentLesson?.id === lesson.id ? 'active' : ''}`}
                    >
                      <div className="t">
                        <b>
                          {idx + 1}. {lesson.title}
                        </b>
                        <br />
                        <small>
                          {lesson.sourceType === 'YOUTUBE'
                            ? 'YouTube nhúng'
                            : `Video tải lên (${formatFileSize(lesson.fileSize)})`}
                          {lesson.duration ? ` · ${lesson.duration}` : ''}
                        </small>
                      </div>
                      <span className={`tag ${lesson.canWatch ? 'free' : 'paid'}`}>
                        {lesson.isFree
                          ? 'Học thử miễn phí'
                          : lesson.canWatch
                          ? 'Được xem'
                          : 'Đã khóa'}
                      </span>
                      <button
                        type="button"
                        className={`btn sm ${currentLesson?.id === lesson.id ? '' : 'alt'}`}
                        onClick={() => setSelectedLessonId(lesson.id)}
                      >
                        {lesson.canWatch ? 'Xem' : 'Mở khóa'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Study Documents */}
              <h3>Tài liệu học tập tải về ({currentCourse.documents.length})</h3>
              {currentCourse.documents.length === 0 ? (
                <p className="hint">Khóa học này chưa có tài liệu Word/PowerPoint đính kèm.</p>
              ) : (
                <div className="lessons">
                  {currentCourse.documents.map((doc) => (
                    <div className="les" key={doc.id}>
                      <div className="t">
                        <b>{doc.title}</b>
                        <br />
                        <small>
                          {doc.originalFileName} · Định dạng .{doc.fileType.toUpperCase()} ·{' '}
                          {formatFileSize(doc.fileSize)}
                        </small>
                        {doc.description && (
                          <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>
                            {doc.description}
                          </div>
                        )}
                      </div>
                      <span className={`tag ${doc.canDownload ? 'free' : 'paid'}`}>
                        {doc.isFree
                          ? 'Miễn phí'
                          : doc.canDownload
                          ? 'Được tải'
                          : 'Cần cấp quyền'}
                      </span>
                      {doc.canDownload && doc.downloadPath ? (
                        <a
                          href={buildMediaUrl(doc.downloadPath)}
                          className="btn jade sm"
                          download
                        >
                          Tải tài liệu
                        </a>
                      ) : (
                        <button type="button" className="btn alt sm" disabled>
                          🔒 Đã khóa
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<p className="hint">Đang tải khóa học...</p>}>
      <CoursesContent />
    </Suspense>
  );
}
