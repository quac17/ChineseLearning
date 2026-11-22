'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, EmptyState, LinkButton, ProgramBadge, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import {
  loadPracticeSet,
  practiceRoutes,
  type PracticeDecks,
  type PracticeSet,
  type PracticeSource,
} from '@/lib/practice';
import s from './practice.module.css';

/** ?lesson=<id> or ?due=true; null when the page should show the deck picker. */
export function usePracticeSource(): PracticeSource | null {
  const sp = useSearchParams();
  const lessonId = sp.get('lesson');
  if (sp.get('due') === 'true') return { due: true };
  if (lessonId) return { lessonId };
  return null;
}

export function usePracticeSet(src: PracticeSource) {
  const { loading: authLoading } = useAuth();
  const [set, setSet] = useState<PracticeSet | null>(null);
  const [error, setError] = useState('');
  const key = 'due' in src ? 'due' : src.lessonId;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setSet(null);
    setError('');
    loadPracticeSet(src)
      .then((d) => !cancelled && setSet(d))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không tải được từ vựng.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, authLoading]);

  return { set, error };
}

export function PracticeShell({
  eyebrow,
  title,
  aside,
  wide,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  aside?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${s.page} ${wide ? s.wide : ''}`}>
      <div className={s.head}>
        <div>
          <p className={s.eyebrow}>{eyebrow}</p>
          <h1 className={s.title}>{title}</h1>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Loading / error / empty states shared by the three practice pages. */
export function SetState({ set, error, eyebrow }: { set: PracticeSet | null; error: string; eyebrow: string }) {
  if (error) {
    return (
      <PracticeShell eyebrow={eyebrow} title="Không mở được bài luyện tập">
        <Alert tone="error">{error}</Alert>
        <LinkButton href={practiceRoutes.hub} variant="outline">
          Chọn bài khác
        </LinkButton>
      </PracticeShell>
    );
  }
  if (!set) {
    return (
      <PracticeShell eyebrow={eyebrow} title={<Skeleton width={260} height={30} />}>
        <Skeleton height={320} />
      </PracticeShell>
    );
  }
  return (
    <PracticeShell eyebrow={eyebrow} title={set.title}>
      <EmptyState
        title="Không có từ nào để luyện"
        action={
          <LinkButton href={practiceRoutes.hub} variant="outline">
            Chọn bài khác
          </LinkButton>
        }
      >
        Bài này chưa có từ vựng, hoặc hôm nay bạn đã ôn hết các từ đến hạn.
      </EmptyState>
    </PracticeShell>
  );
}

/**
 * The "Ôn tập" hub (AppReview): today's due words, then every lesson with
 * words the viewer can practise, each with flashcard / quiz / writing.
 */
export function PracticeHub({ focus }: { focus?: 'flashcards' | 'quiz' | 'writing' }) {
  const { user, loading: authLoading } = useAuth();
  const [decks, setDecks] = useState<PracticeDecks | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    apiRequest<PracticeDecks>('/practice/decks')
      .then((d) => !cancelled && setDecks(d))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không tải được bài luyện tập.'));
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const title = focus === 'quiz' ? 'Quiz' : focus === 'writing' ? 'Luyện viết chữ Hán' : 'Ôn tập';

  return (
    <PracticeShell eyebrow="Luyện tập theo bài" title={title} wide>
      {error && <Alert tone="error">{error}</Alert>}

      {user ? (
        decks && (
          <section className={s.due} aria-labelledby="due-title">
            <div>
              <h2 id="due-title">Hôm nay: {decks.dueCount} từ cần ôn</h2>
              <p className={s.muted}>
                {decks.dueCount > 0
                  ? 'Các từ bạn chưa nhớ hoặc đã đến hạn ôn lại (hộp Leitner).'
                  : 'Chưa có từ nào đến hạn. Học từ mới ở các bài bên dưới.'}
              </p>
            </div>
            {decks.dueCount > 0 && (
              <LinkButton href={practiceRoutes.flashcards({ due: true })} variant="ink">
                Bắt đầu
              </LinkButton>
            )}
          </section>
        )
      ) : (
        <Alert tone="info">
          Bạn luyện được các bài học thử. <Link href={routes.login(practiceRoutes.hub)}>Đăng nhập</Link> để lưu từ đã nhớ
          và ôn đúng hạn.
        </Alert>
      )}

      {!decks && !error ? (
        <Skeleton height={240} />
      ) : decks && decks.courses.length === 0 ? (
        <EmptyState
          title="Chưa có bài nào có từ vựng"
          action={
            <LinkButton href={routes.catalog()} variant="outline">
              Xem khoá học
            </LinkButton>
          }
        >
          Từ vựng xuất hiện ở đây khi giáo viên thêm từ cho bài học bạn xem được.
        </EmptyState>
      ) : (
        decks?.courses.map((c) => (
          <section key={c.courseId} className={s.course} aria-labelledby={`deck-${c.courseId}`}>
            <h2 id={`deck-${c.courseId}`}>
              <ProgramBadge program={c.module} /> {c.courseTitle}
            </h2>
            <ul className={s.lessons}>
              {c.lessons.map((l) => {
                const src = { lessonId: l.lessonId };
                return (
                  <li key={l.lessonId} className={s.lesson}>
                    <span className={s.lessonName}>
                      {l.title}
                      <span>
                        {l.wordCount} từ{user && l.dueCount > 0 ? ` · ${l.dueCount} cần ôn` : ''}
                      </span>
                    </span>
                    <span className={s.row}>
                      <LinkButton href={practiceRoutes.flashcards(src)} variant={focus === 'flashcards' || !focus ? 'ink' : 'outline'} size="sm">
                        Flashcard
                      </LinkButton>
                      <LinkButton href={practiceRoutes.quiz(src)} variant={focus === 'quiz' ? 'ink' : 'outline'} size="sm">
                        Quiz
                      </LinkButton>
                      <LinkButton href={practiceRoutes.writing(src)} variant={focus === 'writing' ? 'ink' : 'outline'} size="sm">
                        Luyện viết
                      </LinkButton>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </PracticeShell>
  );
}
