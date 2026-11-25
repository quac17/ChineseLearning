'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Radio,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { playWordAudio, stopAudio } from '@/lib/speech';
import type {
  ChoiceQuizPayload,
  FillQuizPayload,
  LessonQuizConfig,
  LessonQuizQuestionItem,
  ListenQuizPayload,
  MatchQuizPayload,
  OrderQuizPayload,
  QuizMode,
  QuizQuestionKind,
  VocabularyItem,
} from '@/lib/types';
import { editorHref, move } from '../../../shared';
import { AudioRecorder } from '../../../AudioRecorder';
import s from '../../../teacher.module.css';
import { useEditorCourse } from '../editor';

const KIND_LABELS: Record<QuizQuestionKind, string> = {
  choice: 'Chọn đáp án',
  listen: 'Nghe âm thanh chọn đáp án',
  order: 'Sắp xếp thành câu',
  fill: 'Điền từ vào chỗ trống',
  match: 'Nối cặp',
};

const KIND_LIST: QuizQuestionKind[] = ['choice', 'listen', 'order', 'fill', 'match'];

interface DraftQuestion {
  key: number;
  id?: string;
  kind: QuizQuestionKind;
  vocabularyId: string;
  prompt: string;
  // choice / listen
  options: string[];
  correctIndex: number;
  explanation: string;
  ttsText: string;
  audioOverride: boolean;
  hasAudio: boolean;
  audioOriginalName: string | null;
  audioPath: string | null;
  pendingAudioFile?: File | null;
  pendingAudioUrl?: string | null;
  // order
  piecesText: string;
  orderMeaningVi: string;
  // fill
  fillBefore: string;
  fillAfter: string;
  fillAnswerHanzi: string;
  fillAnswerPinyin: string;
  fillMeaningVi: string;
  // match
  pairs: Array<{ left: string; right: string }>;
}

let nextQKey = 1;

function blankQuestion(kind: QuizQuestionKind): DraftQuestion {
  return {
    key: nextQKey++,
    kind,
    vocabularyId: '',
    prompt: kind === 'listen' ? 'Nghe phát âm và chọn đáp án đúng' : '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
    ttsText: '',
    audioOverride: false,
    hasAudio: false,
    audioOriginalName: null,
    audioPath: null,
    pendingAudioFile: null,
    pendingAudioUrl: null,
    piecesText: '',
    orderMeaningVi: '',
    fillBefore: '',
    fillAfter: '',
    fillAnswerHanzi: '',
    fillAnswerPinyin: '',
    fillMeaningVi: '',
    pairs: [
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
    ],
  };
}

function fromServerQuestion(q: LessonQuizQuestionItem): DraftQuestion {
  const base = blankQuestion(q.kind);
  base.id = q.id;
  base.vocabularyId = q.vocabularyId ?? '';
  base.prompt = q.prompt ?? (q.kind === 'listen' ? 'Nghe phát âm và chọn đáp án đúng' : '');
  base.audioOverride = Boolean(q.audioOverride);
  base.hasAudio = Boolean(q.hasAudio);
  base.audioOriginalName = q.audioOriginalName ?? null;
  base.audioPath = q.audioPath ?? null;

  if (q.kind === 'choice') {
    const p = q.payload as ChoiceQuizPayload;
    base.options = Array.isArray(p.options) && p.options.length >= 2 ? [...p.options] : ['', '', '', ''];
    base.correctIndex = p.correctIndex ?? 0;
    base.explanation = p.explanation ?? '';
  } else if (q.kind === 'listen') {
    const p = q.payload as ListenQuizPayload;
    base.ttsText = p.ttsText ?? '';
    base.options = Array.isArray(p.options) && p.options.length >= 2 ? [...p.options] : ['', '', '', ''];
    base.correctIndex = p.correctIndex ?? 0;
    base.explanation = p.explanation ?? '';
  } else if (q.kind === 'order') {
    const p = q.payload as OrderQuizPayload;
    base.piecesText = Array.isArray(p.pieces) ? p.pieces.join(' | ') : '';
    base.orderMeaningVi = p.meaningVi ?? '';
  } else if (q.kind === 'fill') {
    const p = q.payload as FillQuizPayload;
    base.fillBefore = p.before ?? '';
    base.fillAfter = p.after ?? '';
    base.fillAnswerHanzi = p.answerHanzi ?? '';
    base.fillAnswerPinyin = p.answerPinyin ?? '';
    base.fillMeaningVi = p.meaningVi ?? '';
  } else if (q.kind === 'match') {
    const p = q.payload as MatchQuizPayload;
    base.pairs =
      Array.isArray(p.pairs) && p.pairs.length >= 2
        ? p.pairs.map((pair) => ({ left: pair.left ?? '', right: pair.right ?? '' }))
        : base.pairs;
  }
  return base;
}

function splitPieces(text: string): string[] {
  return text
    .split(/[|｜]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function toApiItem(q: DraftQuestion) {
  let payload: Record<string, any> = {};
  if (q.kind === 'choice') {
    payload = {
      options: q.options.map((x) => x.trim()),
      correctIndex: q.correctIndex,
      explanation: q.explanation.trim() || undefined,
    };
  } else if (q.kind === 'listen') {
    payload = {
      ttsText: q.ttsText.trim(),
      options: q.options.map((x) => x.trim()),
      correctIndex: q.correctIndex,
      explanation: q.explanation.trim() || undefined,
    };
  } else if (q.kind === 'order') {
    payload = {
      pieces: splitPieces(q.piecesText),
      meaningVi: q.orderMeaningVi.trim() || undefined,
    };
  } else if (q.kind === 'fill') {
    payload = {
      before: q.fillBefore,
      after: q.fillAfter,
      answerHanzi: q.fillAnswerHanzi.trim(),
      answerPinyin: q.fillAnswerPinyin.trim() || undefined,
      meaningVi: q.fillMeaningVi.trim() || undefined,
    };
  } else if (q.kind === 'match') {
    payload = {
      pairs: q.pairs
        .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
        .filter((p) => p.left || p.right),
    };
  }
  return {
    id: q.id,
    kind: q.kind,
    vocabularyId: q.vocabularyId || null,
    prompt: q.prompt.trim() || null,
    audioOverride: q.audioOverride,
    payload,
  };
}

function serializeState(mode: QuizMode, questions: DraftQuestion[]): string {
  return JSON.stringify({
    mode,
    questions: questions.map((q) => ({
      ...toApiItem(q),
      pending: Boolean(q.pendingAudioFile),
    })),
  });
}

export default function CourseQuizTab() {
  const { course, setCourse } = useEditorCourse();
  const lessons = course.lessons;
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? '');
  const [pendingLesson, setPendingLesson] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  if (lessons.length === 0) {
    return (
      <div className={s.card}>
        <EmptyState title="Chưa có bài giảng">Thêm bài ở tab Bài giảng trước, rồi cấu hình quiz cho từng bài.</EmptyState>
      </div>
    );
  }

  const choose = (id: string) => {
    if (dirtyRef.current) setPendingLesson(id);
    else setLessonId(id);
  };

  return (
    <>
      <LessonQuizEditor
        key={lessonId}
        courseId={course.id}
        lessonId={lessonId}
        lessonPicker={
          <div className={s.lessonPick}>
            <label htmlFor="quiz-lesson" className={s.legend}>
              Bài
            </label>
            <Select id="quiz-lesson" value={lessonId} onChange={(e) => choose(e.target.value)}>
              {lessons.map((l, i) => (
                <option key={l.id} value={l.id}>
                  {i + 1}. {l.title} (
                  {l.quizMode === 'MANUAL' ? `Thủ công · ${l.quizQuestionCount ?? 0} câu` : `Tự động · ${l.vocabularyCount ?? 0} từ`}
                  )
                </option>
              ))}
            </Select>
          </div>
        }
        onDirtyChange={(dirty) => {
          dirtyRef.current = dirty;
        }}
        onSaved={(quizMode, quizQuestionCount) =>
          setCourse((c) => ({
            ...c,
            lessons: c.lessons.map((l) => (l.id === lessonId ? { ...l, quizMode, quizQuestionCount } : l)),
          }))
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
        <p style={{ margin: 0 }}>Cấu hình quiz của bài này có thay đổi chưa lưu. Chuyển bài sẽ mất các thay đổi đó.</p>
      </Dialog>
    </>
  );
}

function LessonQuizEditor({
  courseId,
  lessonId,
  lessonPicker,
  onDirtyChange,
  onSaved,
}: {
  courseId: string;
  lessonId: string;
  lessonPicker: ReactNode;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (quizMode: QuizMode, count: number) => void;
}) {
  const toast = useToast();
  const [loadedSnap, setLoadedSnap] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState<QuizMode>('AUTO');
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [vocab, setVocab] = useState<VocabularyItem[]>([]);
  const [newKind, setNewKind] = useState<QuizQuestionKind>('listen');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<number | null>(null);
  const questionsRef = useRef<DraftQuestion[]>(questions);
  questionsRef.current = questions;

  const load = useCallback(async () => {
    try {
      const [cfg, words] = await Promise.all([
        apiRequest<LessonQuizConfig>(`/lessons/${encodeURIComponent(lessonId)}/quiz`),
        apiRequest<VocabularyItem[]>(`/lessons/${encodeURIComponent(lessonId)}/vocabulary`),
      ]);
      const drafts = cfg.questions.map(fromServerQuestion);
      setQuizMode(cfg.quizMode);
      setQuestions(drafts);
      setVocab(words);
      setLoadedSnap(serializeState(cfg.quizMode, drafts));
      setLoadError('');
    } catch (err) {
      setLoadError((err as Error).message || 'Không tải được cấu hình quiz.');
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      stopAudio();
      questionsRef.current.forEach((q) => {
        if (q.pendingAudioUrl) URL.revokeObjectURL(q.pendingAudioUrl);
      });
    };
  }, []);

  const dirty = loadedSnap !== null && serializeState(quizMode, questions) !== loadedSnap;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateQ = (key: number, updater: (q: DraftQuestion) => DraftQuestion) =>
    setQuestions((all) => all.map((q) => (q.key === key ? updater(q) : q)));

  const addQuestion = (kind: QuizQuestionKind) => {
    setQuestions((all) => [...all, blankQuestion(kind)]);
  };

  /** Generates editable starter questions from existing lesson vocabulary so teachers can customize fast. */
  const seedFromVocab = () => {
    if (vocab.length === 0) return;
    const generated: DraftQuestion[] = [];
    const meanings = [...new Set(vocab.map((v) => v.meaningVi))];

    const pickDistractors = (correct: string): string[] => {
      const others = meanings.filter((m) => m !== correct).slice(0, 3);
      while (others.length < 3) others.push('');
      return [correct, ...others];
    };

    vocab.slice(0, 8).forEach((w, idx) => {
      const kind: QuizQuestionKind = idx % 2 === 0 ? 'choice' : 'listen';
      const q = blankQuestion(kind);
      q.vocabularyId = w.id;
      q.options = pickDistractors(w.meaningVi);
      q.correctIndex = 0;
      q.explanation = `${w.hanzi} ${w.pinyin} (${w.meaningVi})`;
      if (kind === 'choice') {
        q.prompt = `“${w.hanzi}” nghĩa là gì?`;
      } else {
        q.prompt = 'Nghe phát âm và chọn đáp án đúng';
        q.ttsText = w.hanzi;
      }
      generated.push(q);
    });

    if (vocab.length >= 4) {
      const m = blankQuestion('match');
      m.prompt = 'Nối chữ Hán với nghĩa đúng';
      m.pairs = vocab.slice(0, 4).map((w) => ({ left: w.hanzi, right: w.meaningVi }));
      generated.push(m);
    }

    setQuestions((all) => [...all, ...generated]);
    toast.show(`Đã tạo ${generated.length} câu hỏi mẫu từ từ vựng, bấm "Lưu cấu hình Quiz" để lưu`);
  };

  const applyVocabLink = (q: DraftQuestion, vocabId: string) => {
    const w = vocab.find((v) => v.id === vocabId);
    updateQ(q.key, (cur) => {
      if (!w) return { ...cur, vocabularyId: '' };
      const next = { ...cur, vocabularyId: w.id };
      if (cur.kind === 'choice' && !cur.prompt.trim()) {
        next.prompt = `“${w.hanzi}” nghĩa là gì?`;
      }
      if ((cur.kind === 'choice' || cur.kind === 'listen') && !cur.options[cur.correctIndex]?.trim()) {
        const opts = [...cur.options];
        opts[cur.correctIndex] = w.meaningVi;
        next.options = opts;
      }
      if ((cur.kind === 'choice' || cur.kind === 'listen') && !cur.explanation.trim()) {
        next.explanation = `${w.hanzi} ${w.pinyin} (${w.meaningVi})`;
      }
      if (cur.kind === 'listen') {
        next.ttsText = w.hanzi;
      }
      if (cur.kind === 'fill' && !cur.fillAnswerHanzi.trim()) {
        next.fillAnswerHanzi = w.hanzi;
        next.fillAnswerPinyin = w.pinyin;
        next.fillMeaningVi = w.exampleVi ?? w.meaningVi;
        if (w.exampleZh && w.exampleZh.includes(w.hanzi)) {
          const at = w.exampleZh.indexOf(w.hanzi);
          next.fillBefore = w.exampleZh.slice(0, at);
          next.fillAfter = w.exampleZh.slice(at + w.hanzi.length);
        }
      }
      if (cur.kind === 'order' && !cur.piecesText.trim() && w.exampleZh) {
        next.piecesText = Array.from(w.exampleZh.replace(/[，。！？、；：,.!?;\s]/g, '')).join(' | ');
        next.orderMeaningVi = w.exampleVi ?? w.meaningVi;
      }
      return next;
    });
  };

  const handlePickAudio = async (q: DraftQuestion, file: File | null) => {
    if (!file) return;
    if (q.id) {
      setUploadingKey(q.key);
      setError('');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const updated = await apiRequest<LessonQuizQuestionItem>(
          `/lessons/${encodeURIComponent(lessonId)}/quiz/${encodeURIComponent(q.id)}/audio`,
          { method: 'POST', body: fd },
        );
        updateQ(q.key, (cur) => ({
          ...cur,
          audioOverride: updated.audioOverride,
          hasAudio: updated.hasAudio,
          audioOriginalName: updated.audioOriginalName,
          audioPath: updated.audioPath,
          pendingAudioFile: null,
          pendingAudioUrl: null,
        }));
        toast.show('Đã lưu bản ghi âm cho câu hỏi');
      } catch (err) {
        setError((err as Error).message || 'Không lưu được bản ghi âm.');
      } finally {
        setUploadingKey(null);
      }
      return;
    }

    if (q.pendingAudioUrl) URL.revokeObjectURL(q.pendingAudioUrl);
    const url = URL.createObjectURL(file);
    updateQ(q.key, (cur) => ({
      ...cur,
      audioOverride: true,
      pendingAudioFile: file,
      pendingAudioUrl: url,
    }));
    toast.show('Đã ghi âm xong, bấm "Lưu cấu hình Quiz" để lưu');
  };

  const handleRemoveAudio = async (q: DraftQuestion) => {
    if (q.pendingAudioFile) {
      if (q.pendingAudioUrl) URL.revokeObjectURL(q.pendingAudioUrl);
      updateQ(q.key, (cur) => ({
        ...cur,
        pendingAudioFile: null,
        pendingAudioUrl: null,
        audioOverride: false,
      }));
      return;
    }
    if (!q.id || !q.hasAudio) return;
    setUploadingKey(q.key);
    setError('');
    try {
      const updated = await apiRequest<LessonQuizQuestionItem>(
        `/lessons/${encodeURIComponent(lessonId)}/quiz/${encodeURIComponent(q.id)}/audio`,
        { method: 'DELETE' },
      );
      updateQ(q.key, (cur) => ({
        ...cur,
        audioOverride: updated.audioOverride,
        hasAudio: updated.hasAudio,
        audioOriginalName: updated.audioOriginalName,
        audioPath: updated.audioPath,
      }));
      toast.show('Đã xoá tệp âm thanh ghi đè của câu hỏi');
    } catch (err) {
      setError((err as Error).message || 'Không xoá được tệp âm thanh.');
    } finally {
      setUploadingKey(null);
    }
  };

  const previewQuestionAudio = async (q: DraftQuestion) => {
    const linked = vocab.find((v) => v.id === q.vocabularyId);
    const ok = await playWordAudio({
      localUrl: q.audioOverride ? q.pendingAudioUrl : null,
      audioPath: q.audioOverride && q.hasAudio ? q.audioPath : linked?.audioPath ?? null,
      text: q.ttsText || linked?.hanzi || null,
    });
    if (!ok) toast.show('Chưa có âm thanh hoặc thiết bị chưa hỗ trợ giọng đọc tiếng Trung.');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      let savedCfg = await apiRequest<LessonQuizConfig>(`/lessons/${encodeURIComponent(lessonId)}/quiz`, {
        method: 'PUT',
        body: JSON.stringify({
          quizMode,
          questions: questions.map(toApiItem),
        }),
      });

      // Upload queued audio files for newly created questions (matched by sort_order).
      const pendingUploads = questions
        .map((q, idx) => ({ file: q.pendingAudioFile, url: q.pendingAudioUrl, item: savedCfg.questions[idx] }))
        .filter((x): x is { file: File; url: string | null | undefined; item: LessonQuizQuestionItem } =>
          Boolean(x.file && x.item),
        );

      if (pendingUploads.length > 0) {
        const updatedById = new Map<string, LessonQuizQuestionItem>();
        for (const u of pendingUploads) {
          const fd = new FormData();
          fd.append('file', u.file);
          const up = await apiRequest<LessonQuizQuestionItem>(
            `/lessons/${encodeURIComponent(lessonId)}/quiz/${encodeURIComponent(u.item.id)}/audio`,
            { method: 'POST', body: fd },
          );
          updatedById.set(up.id, up);
          if (u.url) URL.revokeObjectURL(u.url);
        }
        savedCfg = {
          ...savedCfg,
          questions: savedCfg.questions.map((it) => updatedById.get(it.id) ?? it),
        };
      }

      const nextDrafts = savedCfg.questions.map(fromServerQuestion);
      setQuizMode(savedCfg.quizMode);
      setQuestions(nextDrafts);
      setLoadedSnap(serializeState(savedCfg.quizMode, nextDrafts));
      onSaved(savedCfg.quizMode, savedCfg.questions.length);
      toast.show(
        savedCfg.quizMode === 'MANUAL'
          ? `Đã lưu chế độ thủ công (${savedCfg.questions.length} câu hỏi)`
          : 'Đã lưu chế độ tạo quiz tự động',
      );
    } catch (err) {
      setError((err as Error).message || 'Không lưu được cấu hình quiz.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={s.card} aria-labelledby="quiz-editor-title">
      <div className={s.cardHead}>
        {lessonPicker}
        <Badge tone={quizMode === 'MANUAL' ? 'info' : 'neutral'}>
          {quizMode === 'MANUAL' ? `Thủ công · ${questions.length} câu` : `Tự động · ${vocab.length} từ`}
        </Badge>
      </div>
      <h2 id="quiz-editor-title" className="sr-only">
        Cấu hình Quiz cho bài học
      </h2>

      {loadError ? (
        <div className={s.pad}>
          <Alert tone="error">{loadError}</Alert>
        </div>
      ) : loadedSnap === null ? (
        <div className={s.pad}>
          <Skeleton height={220} />
        </div>
      ) : (
        <div className={s.pad} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <fieldset className={s.fieldset}>
            <legend className={s.legend}>Cách tạo Quiz cho bài học này</legend>
            <div className={s.quizModeGrid}>
              <div className={`${s.quizModeCard} ${quizMode === 'AUTO' ? s.quizModeActive : ''}`}>
                <Radio
                  name="quiz-mode"
                  label="Tạo tự động từ từ vựng"
                  checked={quizMode === 'AUTO'}
                  onChange={() => setQuizMode('AUTO')}
                />
                <p className={s.note}>
                  Hệ thống tự sinh tối đa 10 câu hỏi (Chọn đáp án, Nghe chọn đáp án, Sắp xếp câu, Điền từ, Nối cặp) từ danh
                  sách từ vựng của bài học. Hiện có <b>{vocab.length} từ</b>.
                </p>
              </div>
              <div className={`${s.quizModeCard} ${quizMode === 'MANUAL' ? s.quizModeActive : ''}`}>
                <Radio
                  name="quiz-mode"
                  label="Tạo thủ công từng câu hỏi"
                  checked={quizMode === 'MANUAL'}
                  onChange={() => setQuizMode('MANUAL')}
                />
                <p className={s.note}>
                  Giáo viên tự chọn loại câu hỏi, nhập nội dung, đáp án và âm thanh riêng cho từng câu. Học viên sẽ làm đúng
                  bộ câu hỏi này theo thứ tự bạn sắp xếp.
                </p>
              </div>
            </div>
          </fieldset>

          {quizMode === 'AUTO' ? (
            <Alert tone="info">
              Quiz tự động dùng các từ trong tab Từ vựng (cần ít nhất 4 nghĩa khác nhau để tạo câu trắc nghiệm và câu nghe).{' '}
              <LinkButton href={editorHref(courseId, 'vocabulary')} variant="text" size="sm">
                Mở tab Từ vựng
              </LinkButton>
            </Alert>
          ) : (
            <div className={s.stack}>
              <div className={s.cardHeadTight} style={{ flexWrap: 'wrap' }}>
                <div className={s.filters}>
                  <label htmlFor="new-quiz-kind" className="sr-only">
                    Loại câu hỏi mới
                  </label>
                  <Select
                    id="new-quiz-kind"
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as QuizQuestionKind)}
                  >
                    {KIND_LIST.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </Select>
                  <Button variant="ink" size="sm" onClick={() => addQuestion(newKind)}>
                    + Thêm câu hỏi
                  </Button>
                </div>
                {vocab.length > 0 && (
                  <Button variant="outline" size="sm" onClick={seedFromVocab}>
                    Tạo mẫu từ từ vựng ({vocab.length} từ)
                  </Button>
                )}
              </div>

              {questions.length === 0 ? (
                <EmptyState title="Chưa có câu hỏi thủ công nào">
                  Chọn loại câu hỏi rồi bấm “+ Thêm câu hỏi”, hoặc bấm “Tạo mẫu từ từ vựng” để sinh nhanh rồi chỉnh sửa.
                </EmptyState>
              ) : (
                <div className={s.quizList}>
                  {questions.map((q, i) => {
                    const linkedWord = vocab.find((v) => v.id === q.vocabularyId);
                    const audioBusy = uploadingKey === q.key;
                    return (
                      <article key={q.key} className={s.quizCard} aria-label={`Câu hỏi ${i + 1}`}>
                        <div className={s.quizCardHead}>
                          <div className={s.filters}>
                            <strong>Câu {i + 1}</strong>
                            <Select
                              aria-label={`Loại câu hỏi ${i + 1}`}
                              value={q.kind}
                              onChange={(e) => {
                                const nextKind = e.target.value as QuizQuestionKind;
                                updateQ(q.key, (cur) => ({
                                  ...cur,
                                  kind: nextKind,
                                  prompt:
                                    nextKind === 'listen' && !cur.prompt.trim()
                                      ? 'Nghe phát âm và chọn đáp án đúng'
                                      : cur.prompt,
                                }));
                              }}
                            >
                              {KIND_LIST.map((k) => (
                                <option key={k} value={k}>
                                  {KIND_LABELS[k]}
                                </option>
                              ))}
                            </Select>
                            {vocab.length > 0 && (
                              <Select
                                aria-label={`Liên kết từ vựng cho câu ${i + 1}`}
                                value={q.vocabularyId}
                                onChange={(e) => applyVocabLink(q, e.target.value)}
                              >
                                <option value="">Không liên kết từ vựng</option>
                                {vocab.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    Từ: {w.hanzi} ({w.pinyin}) — {w.meaningVi}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </div>
                          <span className={s.order}>
                            <Button
                              variant="subtle"
                              size="sm"
                              iconOnly
                              aria-label={`Đưa câu ${i + 1} lên`}
                              disabled={i === 0}
                              onClick={() => setQuestions((all) => move(all, i, i - 1))}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="subtle"
                              size="sm"
                              iconOnly
                              aria-label={`Đưa câu ${i + 1} xuống`}
                              disabled={i === questions.length - 1}
                              onClick={() => setQuestions((all) => move(all, i, i + 1))}
                            >
                              ↓
                            </Button>
                            <Button
                              variant="subtle"
                              size="sm"
                              iconOnly
                              aria-label={`Xoá câu ${i + 1}`}
                              onClick={() => {
                                if (q.pendingAudioUrl) URL.revokeObjectURL(q.pendingAudioUrl);
                                setQuestions((all) => all.filter((x) => x.key !== q.key));
                              }}
                            >
                              ×
                            </Button>
                          </span>
                        </div>

                        {(q.kind === 'choice' || q.kind === 'listen') && (
                          <div className={s.form}>
                            <Field
                              label={q.kind === 'choice' ? 'Nội dung câu hỏi *' : 'Hướng dẫn câu hỏi'}
                            >
                              <Input
                                id={`q-prompt-${q.key}`}
                                value={q.prompt}
                                placeholder={
                                  q.kind === 'choice'
                                    ? 'Ví dụ: “你好” nghĩa là gì?'
                                    : 'Nghe phát âm và chọn đáp án đúng'
                                }
                                onChange={(e) => updateQ(q.key, (c) => ({ ...c, prompt: e.target.value }))}
                              />
                            </Field>

                            {q.kind === 'listen' && (
                              <div className={s.quizAudioBox}>
                                <div className={s.twoCols}>
                                  <Field
                                    label="Từ / câu tiếng Trung (phát âm thư viện có sẵn)"
                                    hint="Dùng khi không ghi đè tệp âm thanh riêng."
                                  >
                                    <Input
                                      id={`q-tts-${q.key}`}
                                      className="han"
                                      value={q.ttsText}
                                      placeholder="Ví dụ: 你好"
                                      onChange={(e) => updateQ(q.key, (c) => ({ ...c, ttsText: e.target.value }))}
                                    />
                                  </Field>
                                  <div className={s.audioCell}>
                                    <div className={s.audioRow}>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void previewQuestionAudio(q)}
                                      >
                                        Nghe thử
                                      </Button>
                                      <Checkbox
                                        label="Ghi đè âm thanh"
                                        checked={q.audioOverride}
                                        onChange={(e) =>
                                          updateQ(q.key, (c) => ({
                                            ...c,
                                            audioOverride: e.target.checked,
                                          }))
                                        }
                                      />
                                    </div>
                                    {q.audioOverride ? (
                                      <AudioRecorder
                                        hasAudio={Boolean(q.hasAudio || q.pendingAudioFile)}
                                        pendingLocal={Boolean(q.pendingAudioFile)}
                                        busy={audioBusy}
                                        emptyHint="Chưa ghi âm — tạm dùng âm thanh từ vựng / thư viện"
                                        onRecorded={(file) => handlePickAudio(q, file)}
                                        onRemove={() => handleRemoveAudio(q)}
                                        onError={(msg) => {
                                          setError(msg);
                                          toast.show(msg);
                                        }}
                                      />
                                    ) : (
                                      <span className={s.cellHint}>
                                        {linkedWord?.audioPath
                                          ? `Đang dùng bản ghi âm của từ “${linkedWord.hanzi}”`
                                          : 'Đang dùng thư viện giọng đọc có sẵn'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className={s.form}>
                              <span className={s.legend}>Các lựa chọn (chọn 1 đáp án đúng) *</span>
                              {q.options.map((opt, oi) => (
                                <div key={oi} className={s.quizOptionRow}>
                                  <Radio
                                    name={`correct-${q.key}`}
                                    label={`Đáp án ${oi + 1}`}
                                    checked={q.correctIndex === oi}
                                    onChange={() => updateQ(q.key, (c) => ({ ...c, correctIndex: oi }))}
                                  />
                                  <Input
                                    aria-label={`Nội dung đáp án ${oi + 1} câu ${i + 1}`}
                                    value={opt}
                                    placeholder={`Nhập lựa chọn ${oi + 1}`}
                                    onChange={(e) =>
                                      updateQ(q.key, (c) => ({
                                        ...c,
                                        options: c.options.map((x, j) => (j === oi ? e.target.value : x)),
                                      }))
                                    }
                                  />
                                  {q.options.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="subtle"
                                      size="sm"
                                      iconOnly
                                      aria-label={`Xoá lựa chọn ${oi + 1}`}
                                      onClick={() =>
                                        updateQ(q.key, (c) => {
                                          const nextOpts = c.options.filter((_, j) => j !== oi);
                                          const nextIdx =
                                            c.correctIndex === oi
                                              ? 0
                                              : c.correctIndex > oi
                                                ? c.correctIndex - 1
                                                : c.correctIndex;
                                          return { ...c, options: nextOpts, correctIndex: nextIdx };
                                        })
                                      }
                                    >
                                      ×
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {q.options.length < 6 && (
                                <div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateQ(q.key, (c) => ({ ...c, options: [...c.options, ''] }))}
                                  >
                                    + Thêm lựa chọn
                                  </Button>
                                </div>
                              )}
                            </div>

                            <Field label="Giải thích sau khi chọn (tuỳ chọn)">
                              <Input
                                id={`q-exp-${q.key}`}
                                value={q.explanation}
                                placeholder="Ví dụ: 你好 nǐ hǎo (xin chào)"
                                onChange={(e) => updateQ(q.key, (c) => ({ ...c, explanation: e.target.value }))}
                              />
                            </Field>
                          </div>
                        )}

                        {q.kind === 'order' && (
                          <div className={s.form}>
                            <div className={s.twoCols}>
                              <Field label="Nghĩa tiếng Việt gợi ý">
                                <Input
                                  id={`q-order-vi-${q.key}`}
                                  value={q.orderMeaningVi}
                                  placeholder="Ví dụ: Tôi là người Việt Nam"
                                  onChange={(e) => updateQ(q.key, (c) => ({ ...c, orderMeaningVi: e.target.value }))}
                                />
                              </Field>
                              <Field label="Câu hướng dẫn (tuỳ chọn)">
                                <Input
                                  id={`q-order-prompt-${q.key}`}
                                  value={q.prompt}
                                  placeholder="Mặc định: Xếp thành câu “...”"
                                  onChange={(e) => updateQ(q.key, (c) => ({ ...c, prompt: e.target.value }))}
                                />
                              </Field>
                            </div>
                            <Field
                              label="Các mảnh câu theo đúng thứ tự (ngăn cách bằng dấu |) *"
                              hint="Hệ thống sẽ tự động xáo trộn khi học viên làm bài (2 đến 12 mảnh)."
                            >
                              <Input
                                id={`q-order-pieces-${q.key}`}
                                className="han"
                                value={q.piecesText}
                                placeholder="我 | 是 | 越南 | 人"
                                onChange={(e) => updateQ(q.key, (c) => ({ ...c, piecesText: e.target.value }))}
                              />
                            </Field>
                            {splitPieces(q.piecesText).length > 0 && (
                              <div className={s.quizPreview}>
                                <span className={s.note}>Xem trước mảnh:</span>
                                {splitPieces(q.piecesText).map((p, pi) => (
                                  <Badge key={pi} tone="neutral">
                                    <span className="han">{p}</span>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {q.kind === 'fill' && (
                          <div className={s.form}>
                            <div className={s.twoCols}>
                              <Field label="Câu hướng dẫn (tuỳ chọn)">
                                <Input
                                  id={`q-fill-prompt-${q.key}`}
                                  value={q.prompt}
                                  placeholder="Mặc định: Điền từ còn thiếu"
                                  onChange={(e) => updateQ(q.key, (c) => ({ ...c, prompt: e.target.value }))}
                                />
                              </Field>
                              <Field label="Nghĩa câu gợi ý (tuỳ chọn)">
                                <Input
                                  id={`q-fill-vi-${q.key}`}
                                  value={q.fillMeaningVi}
                                  placeholder="Ví dụ: Tôi là giáo viên."
                                  onChange={(e) => updateQ(q.key, (c) => ({ ...c, fillMeaningVi: e.target.value }))}
                                />
                              </Field>
                            </div>
                            <div className={s.quizFillGrid}>
                              <Field label="Phần trước chỗ trống">
                                <Input
                                  id={`q-fill-before-${q.key}`}
                                  className="han"
                                  value={q.fillBefore}
                                  placeholder="我"
                                  onChange={(e) => updateQ(q.key, (c) => ({ ...c, fillBefore: e.target.value }))}
                                />
                              </Field>
                              <Field label="Đáp án chữ Hán *">
                                <Input
                                  id={`q-fill-ans-${q.key}`}
                                  className="han"
                                  value={q.fillAnswerHanzi}
                                  placeholder="是"
                                  onChange={(e) => updateQ(q.key, (c) => ({ ...c, fillAnswerHanzi: e.target.value }))}
                                />
                              </Field>
                              <Field label="Phần sau chỗ trống">
                                <Input
                                  id={`q-fill-after-${q.key}`}
                                  className="han"
                                  value={q.fillAfter}
                                  placeholder="老师。"
                                  onChange={(e) => updateQ(q.key, (c) => ({ ...c, fillAfter: e.target.value }))}
                                />
                              </Field>
                            </div>
                            <Field
                              label="Pinyin đáp án (tuỳ chọn — cho phép học viên gõ pinyin)"
                            >
                              <Input
                                id={`q-fill-py-${q.key}`}
                                value={q.fillAnswerPinyin}
                                placeholder="Ví dụ: shì hoặc shi4"
                                onChange={(e) => updateQ(q.key, (c) => ({ ...c, fillAnswerPinyin: e.target.value }))}
                              />
                            </Field>
                            <div className={s.quizPreview}>
                              <span className={s.note}>Hiển thị với học viên:</span>
                              <span className="han">
                                {q.fillBefore} <strong>___</strong> {q.fillAfter}
                              </span>
                            </div>
                          </div>
                        )}

                        {q.kind === 'match' && (
                          <div className={s.form}>
                            <Field label="Câu hướng dẫn (tuỳ chọn)">
                              <Input
                                id={`q-match-prompt-${q.key}`}
                                value={q.prompt}
                                placeholder="Mặc định: Nối chữ Hán với nghĩa"
                                onChange={(e) => updateQ(q.key, (c) => ({ ...c, prompt: e.target.value }))}
                              />
                            </Field>
                            <span className={s.legend}>Các cặp ghép (2 đến 6 cặp) *</span>
                            {q.pairs.map((pair, pi) => (
                              <div key={pi} className={s.quizMatchRow}>
                                <Input
                                  className="han"
                                  aria-label={`Vế trái cặp ${pi + 1} câu ${i + 1}`}
                                  value={pair.left}
                                  placeholder="Chữ Hán (vd: 你好)"
                                  onChange={(e) =>
                                    updateQ(q.key, (c) => ({
                                      ...c,
                                      pairs: c.pairs.map((x, j) => (j === pi ? { ...x, left: e.target.value } : x)),
                                    }))
                                  }
                                />
                                <Input
                                  aria-label={`Vế phải cặp ${pi + 1} câu ${i + 1}`}
                                  value={pair.right}
                                  placeholder="Nghĩa (vd: xin chào)"
                                  onChange={(e) =>
                                    updateQ(q.key, (c) => ({
                                      ...c,
                                      pairs: c.pairs.map((x, j) => (j === pi ? { ...x, right: e.target.value } : x)),
                                    }))
                                  }
                                />
                                {q.pairs.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="subtle"
                                    size="sm"
                                    iconOnly
                                    aria-label={`Xoá cặp ${pi + 1}`}
                                    onClick={() =>
                                      updateQ(q.key, (c) => ({
                                        ...c,
                                        pairs: c.pairs.filter((_, j) => j !== pi),
                                      }))
                                    }
                                  >
                                    ×
                                  </Button>
                                )}
                              </div>
                            ))}
                            {q.pairs.length < 6 && (
                              <div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateQ(q.key, (c) => ({ ...c, pairs: [...c.pairs, { left: '', right: '' }] }))
                                  }
                                >
                                  + Thêm cặp
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={s.cardHead}>
        <p className={s.note} style={{ maxWidth: '70ch' }}>
          Người học chỉ thấy quiz khi có quyền xem bài học (bài học thử, khoá miễn phí hoặc đã được cấp quyền).
        </p>
        <div className={s.rowActions}>
          {dirty && <span className={s.note}>Có thay đổi chưa lưu</span>}
          <Button variant="ink" loading={busy} disabled={!dirty} onClick={save}>
            Lưu cấu hình Quiz
          </Button>
        </div>
      </div>
      {error && (
        <div className={s.pad}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}
    </section>
  );
}
