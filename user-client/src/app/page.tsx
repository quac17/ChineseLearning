'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModule } from '@/context/ModuleContext';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { DEMO_FLASHCARDS, DEMO_QUIZZES, PROGRAM_MODULES } from '@/lib/modules';
import { CourseItem } from '@/lib/types';

export default function HomePage() {
  const { activeModule, setActiveModule, theme } = useModule();
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = activeModule === 'all' ? '' : `?module=${activeModule}`;
    apiRequest<CourseItem[]>(`/courses${qs}`)
      .then((data) => {
        if (!cancelled) setCourses(data);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeModule, user?.id]);

  const filteredFlashcards = DEMO_FLASHCARDS.filter(
    (f) => activeModule === 'all' || f.module === activeModule,
  );
  const filteredQuizzes = DEMO_QUIZZES.filter(
    (q) => activeModule === 'all' || q.module === activeModule,
  );

  return (
    <>
      <section className="hero">
        <h1 className="han">{theme.han}</h1>
        <p>{theme.desc}</p>
        <div className="row" style={{ marginTop: 16, position: 'relative' }}>
          <Link href="/courses" className="btn">
            Vào học ngay
          </Link>
          {!user && (
            <Link
              href="/login"
              className="btn alt"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}
            >
              Đăng nhập tài khoản
            </Link>
          )}
          {(user?.role === 'TEACHER' || user?.role === 'ADMIN') && (
            <Link
              href="/teacher"
              className="btn alt"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}
            >
              Không gian Giáo viên
            </Link>
          )}
        </div>
      </section>

      {activeModule === 'all' ? (
        <>
          <h2>Chọn chương trình</h2>
          <div className="grid">
            {PROGRAM_MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                className="mod"
                style={{ '--c': m.c1 } as React.CSSProperties}
                onClick={() => setActiveModule(m.id)}
              >
                <span className="han">{m.han}</span>
                <b>{m.name}</b>
                <span>{m.card}</span>
              </button>
            ))}
          </div>

          <h2>Khóa học mới nhất</h2>
          {loading ? (
            <p className="hint">Đang tải danh sách khóa học...</p>
          ) : courses.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0 }}>
                Chưa kết nối được máy chủ API hoặc chưa có khóa học nào. Hãy đảm bảo Backend đang chạy.
              </p>
            </div>
          ) : (
            <div className="lessons">
              {courses.map((course) => (
                <div className="les" key={course.id}>
                  <div className="t">
                    <b>{course.title}</b>
                    <br />
                    <small>
                      {course.lessons.length} video · {course.documents.length} tài liệu · GV:{' '}
                      {course.teacher?.fullName || 'Vân Kính'}
                    </small>
                  </div>
                  <span className={`tag ${course.hasAccess ? 'free' : 'paid'}`}>
                    {course.isFree
                      ? 'Miễn phí'
                      : course.hasAccess
                      ? 'Đã cấp quyền'
                      : 'Cần cấp quyền'}
                  </span>
                  <Link href={`/courses?courseId=${course.id}`} className="btn alt sm">
                    Vào khóa học
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h2>Khóa học & Video ({theme.name})</h2>
          {loading ? (
            <p className="hint">Đang tải khóa học...</p>
          ) : courses.length === 0 ? (
            <p className="hint">Chưa có khóa học nào trong chương trình này.</p>
          ) : (
            <div className="lessons">
              {courses.map((course) => (
                <div className="les" key={course.id}>
                  <div className="t">
                    <b>{course.title}</b>
                    <br />
                    <small>
                      {course.lessons.length} video bài giảng · {course.documents.length} tài liệu tải về
                    </small>
                  </div>
                  <span className={`tag ${course.hasAccess ? 'free' : 'paid'}`}>
                    {course.isFree
                      ? 'Miễn phí'
                      : course.hasAccess
                      ? 'Đã mở khóa'
                      : 'Cần cấp quyền'}
                  </span>
                  <Link href={`/courses?courseId=${course.id}`} className="btn alt sm">
                    Mở khóa học
                  </Link>
                </div>
              ))}
            </div>
          )}

          {filteredFlashcards.length > 0 && (
            <>
              <h2>Flashcard</h2>
              <div className="lessons">
                {filteredFlashcards.map((deck) => (
                  <div className="les" key={deck.id}>
                    <div className="t">
                      <b>{deck.title}</b>
                      <br />
                      <small>{deck.cards.length} thẻ từ vựng</small>
                    </div>
                    <Link href={`/flashcards?deck=${deck.id}`} className="btn alt sm">
                      Mở thẻ
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}

          {filteredQuizzes.length > 0 && (
            <>
              <h2>Quiz ôn tập</h2>
              <div className="lessons">
                {filteredQuizzes.map((qz) => (
                  <div className="les" key={qz.id}>
                    <div className="t">
                      <b>{qz.title}</b>
                      <br />
                      <small>{qz.questions.length} câu hỏi</small>
                    </div>
                    <Link href={`/quiz?quiz=${qz.id}`} className="btn alt sm">
                      Làm bài
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
