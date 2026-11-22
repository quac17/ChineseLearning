'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Field, LinkButton, Skeleton, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import type { LessonQuestionList, QaAuthor } from '@/lib/types';
import s from './discussion.module.css';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

function AuthorLine({ author, createdAt }: { author: QaAuthor; createdAt: string }) {
  return (
    <div className={s.meta}>
      <b className={s.author}>{author.fullName}</b>
      {author.role === 'TEACHER' && <Badge tone="info">Giáo viên</Badge>}
      {author.role === 'ADMIN' && <Badge tone="neutral">Quản trị viên</Badge>}
      <span>{formatDate(createdAt)}</span>
    </div>
  );
}

/**
 * "Hỏi đáp": learners with access to the course ask under the lesson; the
 * course's teacher (or an admin) answers. Everyone with access reads them.
 */
export function LessonQuestions({
  courseId,
  lessonId,
  hasAccess,
}: {
  courseId: string;
  lessonId: string;
  /** Course access from the course payload (free course, enrolled, owner, admin). */
  hasAccess: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<LessonQuestionList | null>(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<LessonQuestionList>(`/questions/lessons/${encodeURIComponent(lessonId)}`));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không tải được hỏi đáp.');
    }
  }, [lessonId]);

  useEffect(() => {
    if (!user || !hasAccess) return;
    setData(null);
    load();
  }, [user, hasAccess, load]);

  if (!user) {
    return (
      <div className={s.empty}>
        <p>Đăng nhập để xem và đặt câu hỏi cho giáo viên.</p>
        <LinkButton href={routes.login(routes.learn(courseId, lessonId))} variant="ink" size="sm">
          Đăng nhập
        </LinkButton>
      </div>
    );
  }
  if (!hasAccess) {
    return (
      <div className={s.empty}>
        <p>Hỏi đáp dành cho học viên đã có quyền xem khoá học. Mở khoá khoá học để hỏi giáo viên.</p>
        <LinkButton href={routes.course(courseId)} variant="outline" size="sm">
          Xem khoá học
        </LinkButton>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>, fail: string) => {
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      toast.show((err as Error).message || fail);
      return false;
    }
  };

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const ok = await run(
      () => apiRequest('/questions', { method: 'POST', body: JSON.stringify({ lessonId, body }) }),
      'Không gửi được câu hỏi.',
    );
    if (ok) setBody('');
    setBusy(false);
  };

  const answer = async (questionId: string) => {
    const text = replies[questionId] ?? '';
    if (!text.trim()) return;
    const ok = await run(
      () =>
        apiRequest(`/questions/${encodeURIComponent(questionId)}/answers`, {
          method: 'POST',
          body: JSON.stringify({ body: text }),
        }),
      'Không gửi được câu trả lời.',
    );
    if (ok) setReplies((r) => ({ ...r, [questionId]: '' }));
  };

  return (
    <div className={s.wrap}>
      <form className={s.form} onSubmit={ask}>
        <Field label="Đặt câu hỏi" hint="Giáo viên của khoá học sẽ trả lời. Học viên khác trong khoá cũng xem được.">
          <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className={s.formRow}>
          <Button type="submit" variant="ink" size="sm" loading={busy} disabled={!body.trim()}>
            Gửi câu hỏi
          </Button>
        </div>
      </form>

      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !data ? (
        <Skeleton height={80} />
      ) : data.questions.length === 0 ? (
        <p className={s.muted}>Chưa có câu hỏi nào cho bài này.</p>
      ) : (
        <ul className={s.list} aria-label="Câu hỏi về bài học">
          {data.questions.map((q) => (
            <li key={q.id} className={s.item}>
              <AuthorLine author={q.author} createdAt={q.createdAt} />
              <p className={s.body}>{q.body}</p>
              {q.canDelete && (
                <div className={s.actions}>
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() =>
                      run(() => apiRequest(`/questions/${encodeURIComponent(q.id)}`, { method: 'DELETE' }), 'Không xoá được câu hỏi.')
                    }
                  >
                    Xoá câu hỏi
                  </Button>
                </div>
              )}
              {q.answers.length > 0 ? (
                <ul className={s.answers} aria-label="Câu trả lời">
                  {q.answers.map((a) => (
                    <li key={a.id} className={s.answer}>
                      <AuthorLine author={a.author} createdAt={a.createdAt} />
                      <p className={s.body}>{a.body}</p>
                      {a.canDelete && (
                        <div className={s.actions}>
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() =>
                              run(
                                () => apiRequest(`/questions/answers/${encodeURIComponent(a.id)}`, { method: 'DELETE' }),
                                'Không xoá được câu trả lời.',
                              )
                            }
                          >
                            Xoá trả lời
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                !data.canAnswer && <p className={s.muted}>Chưa có câu trả lời.</p>
              )}
              {data.canAnswer && (
                <div className={s.form}>
                  <Field label="Trả lời">
                    <Textarea
                      rows={2}
                      maxLength={2000}
                      value={replies[q.id] ?? ''}
                      onChange={(e) => setReplies((r) => ({ ...r, [q.id]: e.target.value }))}
                    />
                  </Field>
                  <div className={s.formRow}>
                    <Button variant="ink" size="sm" onClick={() => answer(q.id)} disabled={!(replies[q.id] ?? '').trim()}>
                      Gửi trả lời
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
