'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Checkbox, Field, LinkButton, Skeleton, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import type { LessonNote } from '@/lib/types';
import s from './discussion.module.css';

/** Video seconds as m:ss / h:mm:ss, e.g. 252 → "4:12". */
export function formatVideoTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(Math.floor(sec % 60)).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

/**
 * "Ghi chú": private notes on this lesson. When the lesson is an uploaded
 * video, a note can keep the moment it was written, and clicking that moment
 * jumps the video back to it. YouTube embeds do not expose their clock here.
 */
export function LessonNotes({
  courseId,
  lessonId,
  hasClock,
  currentTime,
  seek,
}: {
  courseId: string;
  lessonId: string;
  /** The lesson is an uploaded video whose position can be read. */
  hasClock: boolean;
  /** Current second of the uploaded video, or null when there is none. */
  currentTime: () => number | null;
  seek: (seconds: number) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [notes, setNotes] = useState<LessonNote[] | null>(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [pin, setPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setNotes(null);
    setError('');
    apiRequest<LessonNote[]>(`/notes/lessons/${encodeURIComponent(lessonId)}`)
      .then((data) => !cancelled && setNotes(data))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không tải được ghi chú.'));
    return () => {
      cancelled = true;
    };
  }, [user, lessonId]);

  if (!user) {
    return (
      <div className={s.empty}>
        <p>Đăng nhập để ghi chú cho bài học. Ghi chú chỉ mình bạn xem được.</p>
        <LinkButton href={routes.login(routes.learn(courseId, lessonId))} variant="ink" size="sm">
          Đăng nhập
        </LinkButton>
      </div>
    );
  }

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const t = pin ? currentTime() : null;
      const note = await apiRequest<LessonNote>('/notes', {
        method: 'POST',
        body: JSON.stringify({ lessonId, body, ...(t !== null ? { videoSeconds: Math.floor(t) } : {}) }),
      });
      setNotes((list) => sortNotes([...(list ?? []), note]));
      setBody('');
    } catch (err) {
      toast.show((err as Error).message || 'Không lưu được ghi chú.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.body.trim()) return;
    try {
      const note = await apiRequest<LessonNote>(`/notes/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: editing.body }),
      });
      setNotes((list) => (list ?? []).map((n) => (n.id === note.id ? note : n)));
      setEditing(null);
    } catch (err) {
      toast.show((err as Error).message || 'Không lưu được ghi chú.');
    }
  };

  const remove = async (id: string) => {
    try {
      await apiRequest(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setNotes((list) => (list ?? []).filter((n) => n.id !== id));
    } catch (err) {
      toast.show((err as Error).message || 'Không xoá được ghi chú.');
    }
  };

  return (
    <div className={s.wrap}>
      <form className={s.form} onSubmit={add}>
        <Field label="Ghi chú mới" hint="Chỉ mình bạn xem được ghi chú của mình.">
          <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className={s.formRow}>
          {hasClock && (
            <Checkbox
              label="Gắn mốc thời gian đang xem"
              checked={pin}
              onChange={(e) => setPin(e.currentTarget.checked)}
            />
          )}
          <Button type="submit" variant="ink" size="sm" loading={busy} disabled={!body.trim()}>
            Lưu ghi chú
          </Button>
        </div>
      </form>

      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !notes ? (
        <Skeleton height={64} />
      ) : notes.length === 0 ? (
        <p className={s.muted}>Bạn chưa có ghi chú nào cho bài này.</p>
      ) : (
        <ul className={s.list} aria-label="Ghi chú của bạn">
          {notes.map((n) => (
            <li key={n.id} className={s.item}>
              <div className={s.meta}>
                {n.videoSeconds !== null && (
                  <button
                    type="button"
                    className={s.time}
                    onClick={() => seek(n.videoSeconds!)}
                    aria-label={`Tua video tới ${formatVideoTime(n.videoSeconds)}`}
                  >
                    {formatVideoTime(n.videoSeconds)}
                  </button>
                )}
                <span>{formatDate(n.createdAt)}</span>
              </div>
              {editing?.id === n.id ? (
                <div className={s.form}>
                  <Field label="Sửa ghi chú">
                    <Textarea
                      rows={3}
                      maxLength={2000}
                      value={editing.body}
                      onChange={(e) => setEditing({ id: n.id, body: e.target.value })}
                    />
                  </Field>
                  <div className={s.actions}>
                    <Button variant="ink" size="sm" onClick={saveEdit} disabled={!editing.body.trim()}>
                      Lưu
                    </Button>
                    <Button variant="text" size="sm" onClick={() => setEditing(null)}>
                      Huỷ
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={s.body}>{n.body}</p>
                  <div className={s.actions}>
                    <Button variant="text" size="sm" onClick={() => setEditing({ id: n.id, body: n.body })}>
                      Sửa
                    </Button>
                    <Button variant="text" size="sm" onClick={() => remove(n.id)} aria-label="Xoá ghi chú">
                      Xoá
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function sortNotes(list: LessonNote[]): LessonNote[] {
  return [...list].sort((a, b) => {
    if (a.videoSeconds === null && b.videoSeconds === null) return a.createdAt.localeCompare(b.createdAt);
    if (a.videoSeconds === null) return 1;
    if (b.videoSeconds === null) return -1;
    return a.videoSeconds - b.videoSeconds || a.createdAt.localeCompare(b.createdAt);
  });
}
