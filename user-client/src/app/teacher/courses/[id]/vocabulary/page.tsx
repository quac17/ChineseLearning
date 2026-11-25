'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Checkbox, Dialog, EmptyState, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { playWordAudio, stopAudio } from '@/lib/speech';
import type { VocabularyItem } from '@/lib/types';
import { move } from '../../../shared';
import { AudioRecorder } from '../../../AudioRecorder';
import s from '../../../teacher.module.css';
import { useEditorCourse } from '../editor';
import { parseSheet, type WordDraft } from './sheet';

interface Row extends WordDraft {
  /** Local key only, for React and focus. */
  key: number;
  /** Server id of a saved word. Sent back on save so learners keep their review progress. */
  id?: string;
  audioOverride: boolean;
  hasAudio: boolean;
  audioOriginalName: string | null;
  audioPath: string | null;
  /** Audio file selected for a not-yet-saved row; uploaded automatically on save. */
  pendingAudioFile?: File | null;
  pendingAudioUrl?: string | null;
}

let nextKey = 1;
const toRow = (w: WordDraft): Row => ({
  ...w,
  key: nextKey++,
  audioOverride: false,
  hasAudio: false,
  audioOriginalName: null,
  audioPath: null,
  pendingAudioFile: null,
  pendingAudioUrl: null,
});
const emptyRow = (): Row => toRow({ hanzi: '', pinyin: '', meaningVi: '', exampleZh: '', exampleVi: '' });
const fromItem = (v: VocabularyItem): Row => ({
  ...toRow({
    hanzi: v.hanzi,
    pinyin: v.pinyin,
    meaningVi: v.meaningVi,
    exampleZh: v.exampleZh ?? '',
    exampleVi: v.exampleVi ?? '',
  }),
  id: v.id,
  audioOverride: Boolean(v.audioOverride),
  hasAudio: Boolean(v.hasAudio),
  audioOriginalName: v.audioOriginalName ?? null,
  audioPath: v.audioPath ?? null,
});

const sameWords = (a: Row[], b: Row[]) =>
  a.length === b.length &&
  a.every(
    (r, i) =>
      r.id === b[i].id &&
      r.hanzi === b[i].hanzi &&
      r.pinyin === b[i].pinyin &&
      r.meaningVi === b[i].meaningVi &&
      r.exampleZh === b[i].exampleZh &&
      r.exampleVi === b[i].exampleVi &&
      r.audioOverride === b[i].audioOverride &&
      !r.pendingAudioFile,
  );

/** "jiao4", "ni3 hao3": the API turns tone numbers into marks on save. */
const hasToneNumbers = (pinyin: string) => /[a-zü:v][1-5]/i.test(pinyin);

export default function CourseVocabularyTab() {
  const { course, setCourse } = useEditorCourse();
  const lessons = course.lessons;
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? '');
  const [pendingLesson, setPendingLesson] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  if (lessons.length === 0) {
    return (
      <div className={s.card}>
        <EmptyState title="Chưa có bài giảng">Thêm bài ở tab Bài giảng trước, rồi nhập từ vựng cho từng bài.</EmptyState>
      </div>
    );
  }

  const choose = (id: string) => {
    if (dirtyRef.current) setPendingLesson(id);
    else setLessonId(id);
  };

  return (
    <>
      <WordEditor
        key={lessonId}
        lessonId={lessonId}
        lessonPicker={
          <div className={s.lessonPick}>
            <label htmlFor="vocab-lesson" className={s.legend}>
              Bài
            </label>
            <Select id="vocab-lesson" value={lessonId} onChange={(e) => choose(e.target.value)}>
              {lessons.map((l, i) => (
                <option key={l.id} value={l.id}>
                  {i + 1}. {l.title} ({l.vocabularyCount ?? 0} từ)
                </option>
              ))}
            </Select>
          </div>
        }
        onDirtyChange={(dirty) => {
          dirtyRef.current = dirty;
        }}
        onSaved={(count) =>
          setCourse((c) => ({ ...c, lessons: c.lessons.map((l) => (l.id === lessonId ? { ...l, vocabularyCount: count } : l)) }))
        }
      />
      <Dialog
        open={pendingLesson !== null}
        onClose={() => setPendingLesson(null)}
        title="Bỏ các thay đổi chưa lưu?"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setPendingLesson(null)}>
              Ở lại
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                dirtyRef.current = false;
                setLessonId(pendingLesson!);
                setPendingLesson(null);
              }}
            >
              Bỏ thay đổi
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>Từ vựng của bài này có thay đổi chưa lưu. Chuyển bài sẽ mất các thay đổi đó.</p>
      </Dialog>
    </>
  );
}

function WordEditor({
  lessonId,
  lessonPicker,
  onDirtyChange,
  onSaved,
}: {
  lessonId: string;
  lessonPicker: ReactNode;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (count: number) => void;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState<Row[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [pasting, setPasting] = useState(false);
  const focusKey = useRef<number | null>(null);
  const rowsRef = useRef<Row[]>(rows);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    try {
      const items = await apiRequest<VocabularyItem[]>(`/lessons/${lessonId}/vocabulary`);
      const loaded = items.map(fromItem);
      setSaved(loaded);
      setRows(loaded);
    } catch (err) {
      setLoadError((err as Error).message || 'Không tải được từ vựng.');
    }
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      stopAudio();
      rowsRef.current.forEach((r) => {
        if (r.pendingAudioUrl) URL.revokeObjectURL(r.pendingAudioUrl);
      });
    };
  }, []);

  const dirty = saved !== null && !sameWords(rows, saved);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Focus the Hanzi cell of a freshly added row.
  useEffect(() => {
    if (focusKey.current === null) return;
    document.getElementById(`hanzi-${focusKey.current}`)?.focus();
    focusKey.current = null;
  }, [rows]);

  const update = (key: number, field: keyof WordDraft, value: string) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const toggleAudioOverride = (key: number, checked: boolean) => {
    setRows((all) =>
      all.map((r) =>
        r.key === key
          ? {
              ...r,
              audioOverride: checked,
              audioPath: checked && r.hasAudio && r.id ? `/lessons/${encodeURIComponent(lessonId)}/vocabulary/${encodeURIComponent(r.id)}/audio` : null,
            }
          : r,
      ),
    );
  };

  const handlePickAudio = async (row: Row, file: File | null) => {
    if (!file) return;
    if (row.id) {
      setUploadingKey(row.key);
      setError('');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const updated = await apiRequest<VocabularyItem>(
          `/lessons/${encodeURIComponent(lessonId)}/vocabulary/${encodeURIComponent(row.id)}/audio`,
          { method: 'POST', body: fd },
        );
        const patch = (r: Row): Row =>
          r.id === updated.id
            ? {
                ...r,
                audioOverride: updated.audioOverride,
                hasAudio: updated.hasAudio,
                audioOriginalName: updated.audioOriginalName,
                audioPath: updated.audioPath,
                pendingAudioFile: null,
                pendingAudioUrl: null,
              }
            : r;
        setRows((all) => all.map(patch));
        setSaved((all) => (all ? all.map(patch) : all));
        toast.show(`Đã lưu bản ghi âm cho “${row.hanzi || 'từ vựng'}”`);
      } catch (err) {
        setError((err as Error).message || 'Không lưu được bản ghi âm.');
      } finally {
        setUploadingKey(null);
      }
      return;
    }

    // Unsaved row: hold locally for preview and upload automatically on "Lưu từ vựng".
    if (row.pendingAudioUrl) URL.revokeObjectURL(row.pendingAudioUrl);
    const url = URL.createObjectURL(file);
    setRows((all) =>
      all.map((r) =>
        r.key === row.key
          ? {
              ...r,
              audioOverride: true,
              pendingAudioFile: file,
              pendingAudioUrl: url,
            }
          : r,
      ),
    );
    toast.show('Đã ghi âm xong, bấm "Lưu từ vựng" để lưu');
  };

  const handleRemoveAudio = async (row: Row) => {
    if (row.pendingAudioFile) {
      if (row.pendingAudioUrl) URL.revokeObjectURL(row.pendingAudioUrl);
      setRows((all) =>
        all.map((r) =>
          r.key === row.key ? { ...r, pendingAudioFile: null, pendingAudioUrl: null, audioOverride: false } : r,
        ),
      );
      return;
    }
    if (!row.id || !row.hasAudio) return;
    setUploadingKey(row.key);
    setError('');
    try {
      const updated = await apiRequest<VocabularyItem>(
        `/lessons/${encodeURIComponent(lessonId)}/vocabulary/${encodeURIComponent(row.id)}/audio`,
        { method: 'DELETE' },
      );
      const patch = (r: Row): Row =>
        r.id === updated.id
          ? {
              ...r,
              audioOverride: updated.audioOverride,
              hasAudio: updated.hasAudio,
              audioOriginalName: updated.audioOriginalName,
              audioPath: updated.audioPath,
            }
          : r;
      setRows((all) => all.map(patch));
      setSaved((all) => (all ? all.map(patch) : all));
      toast.show('Đã xoá tệp âm thanh ghi đè, quay về thư viện có sẵn');
    } catch (err) {
      setError((err as Error).message || 'Không xoá được tệp âm thanh.');
    } finally {
      setUploadingKey(null);
    }
  };

  const addRow = () => {
    const row = emptyRow();
    focusKey.current = row.key;
    setRows((all) => [...all, row]);
  };

  const isBlank = (r: Row) => !r.hanzi.trim() && !r.pinyin.trim() && !r.meaningVi.trim() && !r.exampleZh.trim() && !r.exampleVi.trim();
  const missing = (r: Row) => !r.hanzi.trim() || !r.pinyin.trim() || !r.meaningVi.trim();

  const save = async () => {
    // Fully empty rows (an unused "+ Thêm từ") are dropped instead of blocking the save.
    const kept = rows.filter((r) => !isBlank(r));
    if (kept.some(missing)) {
      setShowErrors(true);
      setError('Mỗi từ cần đủ chữ Hán, pinyin và nghĩa tiếng Việt.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let items = await apiRequest<VocabularyItem[]>(`/lessons/${lessonId}/vocabulary`, {
        method: 'PUT',
        body: JSON.stringify({
          items: kept.map((r) => ({
            id: r.id,
            hanzi: r.hanzi.trim(),
            pinyin: r.pinyin.trim(),
            meaningVi: r.meaningVi.trim(),
            exampleZh: r.exampleZh.trim() || undefined,
            exampleVi: r.exampleVi.trim() || undefined,
            audioOverride: r.audioOverride,
          })),
        }),
      });

      // Upload queued audio files for newly created rows (indices match server sort_order).
      const pendingUploads = kept
        .map((r, idx) => ({ file: r.pendingAudioFile, url: r.pendingAudioUrl, item: items[idx] }))
        .filter((x): x is { file: File; url: string | null | undefined; item: VocabularyItem } =>
          Boolean(x.file && x.item),
        );

      if (pendingUploads.length > 0) {
        const updatedById = new Map<string, VocabularyItem>();
        for (const u of pendingUploads) {
          const fd = new FormData();
          fd.append('file', u.file);
          const up = await apiRequest<VocabularyItem>(
            `/lessons/${encodeURIComponent(lessonId)}/vocabulary/${encodeURIComponent(u.item.id)}/audio`,
            { method: 'POST', body: fd },
          );
          updatedById.set(up.id, up);
          if (u.url) URL.revokeObjectURL(u.url);
        }
        items = items.map((it) => updatedById.get(it.id) ?? it);
      }

      const next = items.map(fromItem);
      setSaved(next);
      setRows(next);
      setShowErrors(false);
      onSaved(items.length);
      toast.show(`Đã lưu ${items.length} từ vựng`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const previewAudio = async (row: Row) => {
    const ok = await playWordAudio({
      localUrl: row.audioOverride ? row.pendingAudioUrl : null,
      audioPath: row.audioOverride && row.hasAudio ? row.audioPath : null,
      text: row.hanzi,
    });
    if (!ok) toast.show('Thiết bị này chưa có giọng đọc tiếng Trung hoặc chưa có tệp âm thanh.');
  };

  return (
    <section className={s.card} aria-labelledby="vocab-title">
      <div className={s.cardHead}>
        {lessonPicker}
        <div className={s.rowActions}>
          <Button variant="outline" size="sm" onClick={() => setPasting(true)} disabled={!saved}>
            Dán từ bảng tính
          </Button>
          <Button variant="ink" size="sm" onClick={addRow} disabled={!saved}>
            + Thêm từ
          </Button>
        </div>
      </div>
      <h2 id="vocab-title" className="sr-only">
        Danh sách từ vựng
      </h2>

      {loadError ? (
        <div className={s.pad}>
          <Alert tone="error">{loadError}</Alert>
        </div>
      ) : !saved ? (
        <div className={s.pad}>
          <Skeleton height={200} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Bài này chưa có từ vựng">
          Thêm từng từ, hoặc dán nhiều dòng từ bảng tính (Excel, Google Sheets).
        </EmptyState>
      ) : (
        <div className={s.scroll}>
          <table className={`${s.table} ${s.vocabTable}`}>
            <thead>
              <tr>
                <th scope="col">Chữ Hán</th>
                <th scope="col">Pinyin</th>
                <th scope="col">Nghĩa tiếng Việt</th>
                <th scope="col">Câu ví dụ (không bắt buộc)</th>
                <th scope="col">Nghĩa câu ví dụ</th>
                <th scope="col">Âm thanh</th>
                <th scope="col">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const n = i + 1;
                const toneHint = hasToneNumbers(r.pinyin);
                const audioBusy = uploadingKey === r.key;
                return (
                  <tr key={r.key}>
                    <td>
                      <input
                        id={`hanzi-${r.key}`}
                        className={`${s.cell} ${s.cellHan} han`}
                        aria-label={`Chữ Hán từ ${n}`}
                        aria-invalid={(showErrors && !r.hanzi.trim()) || undefined}
                        value={r.hanzi}
                        maxLength={50}
                        onChange={(e) => update(r.key, 'hanzi', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={s.cell}
                        aria-label={`Pinyin từ ${n}`}
                        aria-invalid={(showErrors && !r.pinyin.trim()) || undefined}
                        aria-describedby={toneHint ? `tone-${r.key}` : undefined}
                        value={r.pinyin}
                        maxLength={120}
                        onChange={(e) => update(r.key, 'pinyin', e.target.value)}
                      />
                      {toneHint && (
                        <span id={`tone-${r.key}`} className={s.cellHint}>
                          Số thanh sẽ đổi thành dấu khi lưu
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        className={s.cell}
                        aria-label={`Nghĩa từ ${n}`}
                        aria-invalid={(showErrors && !r.meaningVi.trim()) || undefined}
                        value={r.meaningVi}
                        maxLength={255}
                        onChange={(e) => update(r.key, 'meaningVi', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={`${s.cell} han`}
                        aria-label={`Câu ví dụ từ ${n}`}
                        value={r.exampleZh}
                        maxLength={500}
                        onChange={(e) => update(r.key, 'exampleZh', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={s.cell}
                        aria-label={`Nghĩa câu ví dụ từ ${n}`}
                        value={r.exampleVi}
                        maxLength={500}
                        onChange={(e) => update(r.key, 'exampleVi', e.target.value)}
                      />
                    </td>
                    <td>
                      <div className={s.audioCell}>
                        <div className={s.audioRow}>
                          <Button
                            variant="subtle"
                            size="sm"
                            iconOnly
                            aria-label={`Nghe từ ${n}`}
                            onClick={() => void previewAudio(r)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
                            </svg>
                          </Button>
                          <Checkbox
                            label="Ghi đè âm thanh"
                            checked={r.audioOverride}
                            onChange={(e) => toggleAudioOverride(r.key, e.target.checked)}
                          />
                        </div>
                        {r.audioOverride ? (
                          <AudioRecorder
                            hasAudio={Boolean(r.hasAudio || r.pendingAudioFile)}
                            pendingLocal={Boolean(r.pendingAudioFile)}
                            busy={audioBusy}
                            emptyHint="Chưa ghi âm — tạm dùng thư viện có sẵn"
                            onRecorded={(file) => handlePickAudio(r, file)}
                            onRemove={() => handleRemoveAudio(r)}
                            onError={(msg) => {
                              setError(msg);
                              toast.show(msg);
                            }}
                          />
                        ) : (
                          <span className={s.cellHint}>
                            Dùng thư viện có sẵn{r.hasAudio ? ' (đã có bản ghi âm lưu sẵn)' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={s.order}>
                        <Button variant="subtle" size="sm" iconOnly aria-label={`Đưa từ ${n} lên`} disabled={i === 0} onClick={() => setRows((all) => move(all, i, i - 1))}>
                          ↑
                        </Button>
                        <Button
                          variant="subtle"
                          size="sm"
                          iconOnly
                          aria-label={`Đưa từ ${n} xuống`}
                          disabled={i === rows.length - 1}
                          onClick={() => setRows((all) => move(all, i, i + 1))}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="subtle"
                          size="sm"
                          iconOnly
                          aria-label={`Xoá từ ${n}`}
                          onClick={() => {
                            if (r.pendingAudioUrl) URL.revokeObjectURL(r.pendingAudioUrl);
                            setRows((all) => all.filter((x) => x.key !== r.key));
                          }}
                        >
                          ×
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={s.cardHead}>
        <p className={s.note} style={{ maxWidth: '72ch' }}>
          Từ vựng của bài tự sinh flashcard, quiz và bài luyện viết cho học viên. Gõ pinyin có dấu, hoặc số thanh 1–4 sau âm tiết
          (“jiao4” thành “jiào”). Mặc định phát âm dùng thư viện giọng đọc có sẵn; bật “Ghi đè âm thanh” để ghi âm trực tiếp bằng micro.
        </p>
        <div className={s.rowActions}>
          {dirty && <span className={s.note}>Có thay đổi chưa lưu</span>}
          <Button variant="ink" loading={busy} disabled={!dirty} onClick={save}>
            Lưu từ vựng
          </Button>
        </div>
      </div>
      {error && (
        <div className={s.pad}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <PasteDialog
        open={pasting}
        onClose={() => setPasting(false)}
        onApply={(words, replace) => {
          const added = words.map(toRow);
          // Unused empty rows go; everything typed so far stays unless "replace" is ticked.
          setRows((all) => (replace ? added : [...all.filter((r) => !isBlank(r)), ...added]));
          setPasting(false);
          toast.show(`Đã thêm ${words.length} từ, bấm "Lưu từ vựng" để lưu`);
        }}
      />
    </section>
  );
}

function PasteDialog({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (words: WordDraft[], replace: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const parsed = parseSheet(text);

  useEffect(() => {
    if (open) {
      setText('');
      setReplace(false);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dán từ bảng tính"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="ink" size="sm" disabled={parsed.words.length === 0} onClick={() => onApply(parsed.words, replace)}>
            Thêm {parsed.words.length} từ
          </Button>
        </>
      }
    >
      <p className={s.note} style={{ margin: 0 }}>
        Chép các dòng từ Excel hoặc Google Sheets, mỗi dòng một từ, các cột theo thứ tự: chữ Hán, pinyin, nghĩa, câu ví dụ, nghĩa câu
        ví dụ (hai cột cuối không bắt buộc).
      </p>
      <label htmlFor="vocab-paste" className="sr-only">
        Nội dung dán từ bảng tính
      </label>
      <Textarea
        id="vocab-paste"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={'你好\tnǐ hǎo\txin chào\n谢谢\txie4xie\tcảm ơn'}
      />
      {parsed.skipped.length > 0 && (
        <Alert tone="warning">
          Bỏ qua dòng {parsed.skipped.join(', ')}: thiếu chữ Hán, pinyin hoặc nghĩa (các cột cách nhau bằng phím Tab).
        </Alert>
      )}
      <Checkbox label="Thay toàn bộ danh sách hiện tại" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
    </Dialog>
  );
}
