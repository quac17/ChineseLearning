'use client';

import { useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  Radio,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { courseOutline, hasSections, sectionHeading } from '@/lib/courses';
import type { CourseSection, LessonItem } from '@/lib/types';
import { FileDrop } from '../../../FileDrop';
import { move } from '../../../shared';
import s from '../../../teacher.module.css';
import { uploadWithProgress } from '../../../upload';
import { useEditorCourse } from '../editor';

const VIDEO_ACCEPT = '.mp4,.webm,.mov,.m4v,.ogg,.mkv';
const SUBTITLE_ACCEPT = '.vtt,text/vtt';

type Source = 'UPLOAD' | 'YOUTUBE';
/** null = closed, 'new' = add, otherwise the lesson being edited. */
type Editing = null | 'new' | LessonItem;

export default function CourseLessonsTab() {
  const toast = useToast();
  const { course, reload, setCourse } = useEditorCourse();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<LessonItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const lessons = course.lessons;
  const sections = course.sections ?? [];
  const parts = hasSections(course);
  // With sections the lessons arrive section by section; arrows move a lesson inside its own section.
  // Without sections, keep the local order as is so an optimistic reorder shows at once.
  const groups = parts ? courseOutline(course) : [{ section: null, number: 0, lessons }];

  const reorder = async (from: number, to: number) => {
    const next = move(lessons, from, to);
    if (next === lessons) return;
    setCourse((c) => ({ ...c, lessons: next }));
    try {
      await apiRequest('/lessons/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ courseId: course.id, orderedIds: next.map((l) => l.id) }),
      });
      if (parts) await reload();
    } catch (err) {
      toast.show((err as Error).message || 'Không lưu được thứ tự.');
      reload();
    }
  };

  const setPreview = async (lesson: LessonItem, isFree: boolean) => {
    setBusyId(lesson.id);
    try {
      await apiRequest(`/lessons/${lesson.id}`, { method: 'PATCH', body: JSON.stringify({ isFree }) });
      setCourse((c) => ({ ...c, lessons: c.lessons.map((l) => (l.id === lesson.id ? { ...l, isFree } : l)) }));
      toast.show(isFree ? `"${lesson.title}" là bài học thử` : `"${lesson.title}" chỉ cho học viên có quyền`);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await apiRequest(`/lessons/${deleting.id}`, { method: 'DELETE' });
      toast.show(`Đã xoá bài "${deleting.title}"`);
      if (editing !== 'new' && editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={s.body}>
      <section className={`${s.card} ${s.mainCol}`} aria-labelledby="lessons-title">
        <div className={s.cardHead}>
          <h2 id="lessons-title" className={s.cardTitle}>
            {lessons.length} bài giảng
          </h2>
          <Button variant="ink" size="sm" onClick={() => setEditing('new')}>
            + Thêm bài
          </Button>
        </div>
        {lessons.length === 0 && !parts ? (
          <EmptyState title="Chưa có bài giảng">Thêm bài đầu tiên bằng video tải lên hoặc link YouTube.</EmptyState>
        ) : (
          groups.map((group) => (
            <div key={group.section?.id ?? 'rest'}>
              {parts && (
                <h3 className={s.partHead}>
                  <span>{sectionHeading(group)}</span>
                  <span className={s.rowMeta}>{group.lessons.length} bài</span>
                </h3>
              )}
              {group.lessons.length === 0 ? (
                <p className={`${s.note} ${s.pad}`}>Chưa có bài. Chọn Phần này khi thêm hoặc sửa bài.</p>
              ) : (
                <ol className={s.rows}>
                  {group.lessons.map((l, j) => {
                    const i = lessons.indexOf(l);
                    const first = j === 0;
                    const last = j === group.lessons.length - 1;
                    const exposed = l.sourceType === 'YOUTUBE' && !l.isFree && !course.isFree;
                    return (
                      <li key={l.id} className={s.row} data-warn={exposed || undefined}>
                        <span className={s.order}>
                          <Button variant="subtle" size="sm" iconOnly aria-label={`Đưa bài "${l.title}" lên`} disabled={first} onClick={() => reorder(i, i - 1)}>
                            ↑
                          </Button>
                          <Button
                            variant="subtle"
                            size="sm"
                            iconOnly
                            aria-label={`Đưa bài "${l.title}" xuống`}
                            disabled={last}
                            onClick={() => reorder(i, i + 1)}
                          >
                            ↓
                          </Button>
                        </span>
                        <span className={s.rowMain}>
                          <b>
                            {i + 1}. {l.title}
                          </b>
                          <span className={exposed ? s.warnText : s.rowMeta}>
                            {exposed
                              ? 'YouTube trong bài trả phí: ai có link cũng xem được'
                              : [l.duration, `${l.vocabularyCount ?? 0} từ vựng`].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className={s.rowSource}>
                          {l.sourceType === 'YOUTUBE' ? <Badge tone="warning">YouTube</Badge> : <Badge tone="neutral">Video tải lên</Badge>}
                        </span>
                        <span className={s.rowSwitch}>
                          <Switch
                            label={<span className="sr-only">Học thử bài {l.title}</span>}
                            checked={l.isFree || course.isFree}
                            disabled={course.isFree || busyId === l.id}
                            onChange={(next) => setPreview(l, next)}
                          />
                        </span>
                        <span className={s.rowActions}>
                          <Button variant="outline" size="sm" aria-label={`Sửa bài ${l.title}`} onClick={() => setEditing(l)}>
                            Sửa
                          </Button>
                          <Button variant="text" size="sm" aria-label={`Xoá bài ${l.title}`} onClick={() => setDeleting(l)}>
                            Xoá
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))
        )}
        <p className={`${s.note} ${s.pad}`}>
          Công tắc là <b>Học thử</b>: bài học thử xem miễn phí, không cần mua.{' '}
          {course.isFree && 'Khoá này miễn phí nên mọi bài đều xem được.'}
        </p>
      </section>

      <SectionsPanel courseId={course.id} sections={sections} onChanged={reload} />

      {editing && (
        <LessonForm
          key={editing === 'new' ? 'new' : editing.id}
          courseId={course.id}
          sections={sections}
          lesson={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            toast.show(msg);
            await reload();
          }}
        />
      )}

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Xoá bài "${deleting?.title ?? ''}"?`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              Huỷ
            </Button>
            <Button variant="danger" size="sm" loading={busyId === deleting?.id} onClick={remove}>
              Xoá bài
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>Video tải lên và từ vựng của bài cũng bị xoá. Việc này không hoàn tác được.</p>
      </Dialog>
    </div>
  );
}

/** "Phần" of the course: add, rename, reorder, delete (lessons stay, without a section). */
function SectionsPanel({
  courseId,
  sections,
  onChanged,
}: {
  courseId: string;
  sections: CourseSection[];
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [newTitle, setNewTitle] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await work();
      await onChanged();
      toast.show(message);
      return true;
    } catch (err) {
      toast.show((err as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (title.length < 2) return toast.show('Tên phần tối thiểu 2 ký tự');
    const ok = await run(
      'new',
      () => apiRequest(`/courses/${courseId}/sections`, { method: 'POST', body: JSON.stringify({ title }) }),
      `Đã thêm phần "${title}"`,
    );
    if (ok) setNewTitle('');
  };

  const rename = (section: CourseSection) => {
    const title = (names[section.id] ?? section.title).trim();
    return run(
      section.id,
      () => apiRequest(`/courses/${courseId}/sections/${section.id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
      'Đã đổi tên phần',
    );
  };

  const reorder = (from: number, to: number) => {
    const next = move(sections, from, to);
    if (next === sections) return;
    return run(
      'order',
      () =>
        apiRequest(`/courses/${courseId}/sections/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ orderedIds: next.map((x) => x.id) }),
        }),
      'Đã đổi thứ tự phần',
    );
  };

  const remove = (section: CourseSection) =>
    run(
      section.id,
      () => apiRequest(`/courses/${courseId}/sections/${section.id}`, { method: 'DELETE' }),
      `Đã xoá phần "${section.title}"; các bài vẫn còn trong khoá`,
    );

  return (
    <section className={`${s.card} ${s.panel} ${s.mainCol}`} aria-labelledby="parts-title">
      <h2 id="parts-title" className={s.cardTitle}>
        Phần (chương)
      </h2>
      <p className={s.note}>
        Nhóm bài theo Phần để học viên thấy lộ trình. Không có Phần nào thì danh sách bài hiện liền một mạch. Chọn Phần cho
        từng bài trong ô Sửa bài.
      </p>
      {sections.length > 0 && (
        <ol className={s.partList}>
          {sections.map((section, i) => {
            const value = names[section.id] ?? section.title;
            const changed = value.trim() !== section.title && value.trim().length >= 2;
            return (
              <li key={section.id} className={s.partRow}>
                <span className={s.order}>
                  <Button variant="subtle" size="sm" iconOnly aria-label={`Đưa phần "${section.title}" lên`} disabled={i === 0 || busy !== null} onClick={() => reorder(i, i - 1)}>
                    ↑
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    iconOnly
                    aria-label={`Đưa phần "${section.title}" xuống`}
                    disabled={i === sections.length - 1 || busy !== null}
                    onClick={() => reorder(i, i + 1)}
                  >
                    ↓
                  </Button>
                </span>
                <span className={s.partNo}>Phần {i + 1}</span>
                <Input
                  aria-label={`Tên phần ${i + 1}`}
                  value={value}
                  maxLength={255}
                  onChange={(e) => setNames((n) => ({ ...n, [section.id]: e.target.value }))}
                />
                <span className={s.rowActions}>
                  <Button variant="outline" size="sm" disabled={!changed} loading={busy === section.id} onClick={() => rename(section)}>
                    Lưu tên
                  </Button>
                  <Button variant="text" size="sm" aria-label={`Xoá phần ${section.title}`} disabled={busy !== null} onClick={() => remove(section)}>
                    Xoá
                  </Button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <form className={s.partAdd} onSubmit={add}>
        <Input aria-label="Tên phần mới" placeholder="Ví dụ: Phát âm và chào hỏi" value={newTitle} maxLength={255} onChange={(e) => setNewTitle(e.target.value)} />
        <Button type="submit" variant="ink" size="sm" loading={busy === 'new'}>
          + Thêm phần
        </Button>
      </form>
    </section>
  );
}

function LessonForm({
  courseId,
  sections,
  lesson,
  onClose,
  onSaved,
}: {
  courseId: string;
  sections: CourseSection[];
  lesson: LessonItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [source, setSource] = useState<Source>(lesson?.sourceType ?? 'UPLOAD');
  const [youtubeUrl, setYoutubeUrl] = useState(lesson?.youtubeUrl ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(lesson?.duration ?? '');
  const [isFree, setIsFree] = useState(lesson?.isFree ?? false);
  const [sectionId, setSectionId] = useState(lesson?.sectionId ?? '');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  // Pinyin subtitles (WebVTT), only for uploaded videos.
  const [subtitle, setSubtitle] = useState<File | null>(null);
  const [dropSubtitle, setDropSubtitle] = useState(false);

  const keepsVideo = lesson !== null && source === lesson.sourceType && !file && (source === 'UPLOAD' || youtubeUrl === (lesson.youtubeUrl ?? ''));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (title.trim().length < 2) return setError('Tiêu đề bài giảng tối thiểu 2 ký tự');
    if (source === 'YOUTUBE' && !youtubeUrl.trim()) return setError('Nhập link hoặc ID video YouTube');
    if (source === 'UPLOAD' && !file && !(lesson && lesson.sourceType === 'UPLOAD')) return setError('Chọn file video để tải lên');

    const fields = { title: title.trim(), description, duration, isFree, ...(sections.length ? { sectionId: sectionId || null } : {}) };
    setProgress(source === 'UPLOAD' && file ? 0 : null);
    let savedId = lesson?.id ?? null;
    try {
      if (source === 'UPLOAD' && file) {
        const fd = new FormData();
        if (!lesson) fd.append('courseId', courseId);
        fd.append('title', fields.title);
        fd.append('description', description);
        fd.append('duration', duration);
        fd.append('isFree', String(isFree));
        if (sections.length) fd.append('sectionId', sectionId);
        fd.append('file', file);
        const saved = await uploadWithProgress<{ id: string }>(
          lesson ? `/lessons/${lesson.id}/upload` : '/lessons/upload',
          lesson ? 'PATCH' : 'POST',
          fd,
          setProgress,
        );
        savedId = saved?.id ?? savedId;
        // Replacing a video keeps the lesson's other fields; move it to the chosen Phần separately.
        if (lesson && sections.length && (sectionId || null) !== (lesson.sectionId ?? null)) {
          await apiRequest(`/lessons/${lesson.id}`, { method: 'PATCH', body: JSON.stringify({ sectionId: sectionId || null }) });
        }
      } else if (!lesson) {
        await apiRequest('/lessons/youtube', { method: 'POST', body: JSON.stringify({ ...fields, courseId, youtubeUrl: youtubeUrl.trim() }) });
      } else {
        await apiRequest(`/lessons/${lesson.id}`, {
          method: 'PATCH',
          body: JSON.stringify(source === 'YOUTUBE' && !keepsVideo ? { ...fields, youtubeUrl: youtubeUrl.trim() } : fields),
        });
      }
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
      return;
    }
    const message = lesson ? 'Đã lưu bài giảng' : 'Đã thêm bài giảng vào cuối danh sách';
    // The lesson is saved; a subtitle failure is reported without losing it.
    try {
      if (source === 'UPLOAD' && subtitle && savedId) {
        const fd = new FormData();
        fd.append('file', subtitle);
        await uploadWithProgress(`/lessons/${savedId}/subtitle`, 'POST', fd, () => undefined);
      } else if (source === 'UPLOAD' && dropSubtitle && lesson) {
        await apiRequest(`/lessons/${lesson.id}/subtitle`, { method: 'DELETE' });
      }
      onSaved(message);
    } catch (err) {
      onSaved(`${message}, nhưng phụ đề chưa lưu được: ${(err as Error).message}`);
    }
  };

  const busy = progress !== null;
  return (
    <aside className={`${s.card} ${s.panel} ${s.sideCol} ${s.floating}`} aria-labelledby="lesson-form-title">
      <div className={s.cardHeadTight}>
        <h2 id="lesson-form-title" className={s.cardTitle}>
          {lesson ? 'Sửa bài giảng' : 'Thêm bài giảng'}
        </h2>
        <Button variant="subtle" size="sm" iconOnly aria-label="Đóng" onClick={onClose}>
          ×
        </Button>
      </div>
      <form className={s.form} onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Tiêu đề">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bài 5: Gia đình" maxLength={255} />
        </Field>
        <fieldset className={s.fieldset}>
          <legend className={s.legend}>Nguồn video</legend>
          <Radio name="source" label="Tải video lên (bảo vệ bài trả phí)" checked={source === 'UPLOAD'} onChange={() => setSource('UPLOAD')} />
          <Radio name="source" label="Link YouTube (chỉ nên dùng cho bài học thử)" checked={source === 'YOUTUBE'} onChange={() => setSource('YOUTUBE')} />
        </fieldset>
        {source === 'UPLOAD' ? (
          <>
            <FileDrop label="Tệp video" accept={VIDEO_ACCEPT} hint=".mp4, .webm, .mov, .m4v, .ogg, .mkv" file={file} onFile={setFile} />
            {lesson?.sourceType === 'UPLOAD' && !file && (
              <p className={s.note}>Đang dùng {lesson.originalFileName ?? 'video đã tải lên'}. Chọn file mới để thay.</p>
            )}
            <span className={s.legend} aria-hidden="true">
              Phụ đề pinyin (không bắt buộc)
            </span>
            <FileDrop
              label="Phụ đề pinyin"
              accept={SUBTITLE_ACCEPT}
              hint="Tệp WebVTT (.vtt), dòng đầu là WEBVTT"
              file={subtitle}
              onFile={(f) => {
                setSubtitle(f);
                if (f) setDropSubtitle(false);
              }}
            />
            {lesson?.subtitlePath && !subtitle && (
              <Checkbox
                label="Bài đã có phụ đề. Xoá phụ đề hiện có khi lưu"
                checked={dropSubtitle}
                onChange={(e) => setDropSubtitle(e.currentTarget.checked)}
              />
            )}
          </>
        ) : (
          <Field label="Link YouTube" hint="Ví dụ https://www.youtube.com/watch?v=… hoặc chỉ ID video">
            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} inputMode="url" />
          </Field>
        )}
        {sections.length > 0 && (
          <Field label="Phần">
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Không thuộc phần nào</option>
              {sections.map((x, i) => (
                <option key={x.id} value={x.id}>
                  Phần {i + 1}: {x.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className={s.twoCols}>
          {/* TODO(course fields issue): numeric duration replaces this free text. */}
          <Field label="Thời lượng">
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="15 phút" maxLength={50} />
          </Field>
          <Checkbox label="Học thử: cho xem miễn phí" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        </div>
        <Field label="Mô tả bài">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
        {progress !== null && (
          <div className={s.progressRow}>
            <ProgressBar value={progress} label="Tiến độ tải lên" />
            <span className={s.note}>{progress < 100 ? `Đang tải lên… ${progress}%` : 'Đang xử lý…'}</span>
          </div>
        )}
        <div className={s.formActions}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button type="submit" variant="ink" size="sm" loading={busy}>
            Lưu bài
          </Button>
        </div>
      </form>
    </aside>
  );
}
