'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, LinkButton, Skeleton, useToast } from '@/components/ui';
import { PracticeHub, PracticeShell, SetState, usePracticeSet, usePracticeSource } from '@/components/practice/shared';
import s from '@/components/practice/practice.module.css';
import { useAuth } from '@/context/AuthContext';
import { practiceRoutes, saveReviews, type PracticeSet, type PracticeSource, type PracticeWord } from '@/lib/practice';
import { buildManualQuiz, buildQuiz, fillIsRight, orderIsRight, type Question } from '@/lib/quiz';
import { playWordAudio, stopAudio } from '@/lib/speech';

export default function QuizPage() {
  return (
    <Suspense fallback={<Skeleton height={320} />}>
      <QuizRoute />
    </Suspense>
  );
}

function QuizRoute() {
  const src = usePracticeSource();
  if (!src) return <PracticeHub focus="quiz" />;
  return <Loader key={'due' in src ? 'due' : src.lessonId} src={src} />;
}

function Loader({ src }: { src: PracticeSource }) {
  const { set, error } = usePracticeSet(src);
  const [round, setRound] = useState(0);
  const hasContent =
    Boolean(set) &&
    ((set!.quizMode === 'MANUAL' && (set!.manualQuestions?.length ?? 0) > 0) || set!.words.length > 0);
  if (!set || !hasContent) return <SetState set={set} error={error} eyebrow="Quiz" />;
  return <Quiz key={round} set={set} src={src} onRestart={() => setRound((r) => r + 1)} />;
}

type Verdict = { right: boolean; text: string } | null;

function Quiz({ set, src, onRestart }: { set: PracticeSet; src: PracticeSource; onRestart: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const isManual = set.quizMode === 'MANUAL';
  const questions = useMemo(
    () => (isManual ? buildManualQuiz(set.manualQuestions ?? [], set.words) : buildQuiz(set)),
    [isManual, set],
  );
  const [pos, setPos] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [score, setScore] = useState(0);
  const [wrongWords, setWrongWords] = useState<PracticeWord[]>([]);
  const done = pos >= questions.length;

  useEffect(() => () => stopAudio(), []);

  const record = (right: boolean, words: PracticeWord[], text: string) => {
    if (right) setScore((n) => n + 1);
    else if (words.length > 0) {
      setWrongWords((w) => [...w, ...words.filter((x) => !w.some((y) => y.id === x.id))]);
    }
    setVerdict({ right, text });
    if (words.length > 0) {
      saveReviews(
        Boolean(user),
        words.map((w) => ({ vocabularyId: w.id, outcome: right ? 'quiz_correct' : 'quiz_wrong' })),
      ).catch(() => toast.show('Không lưu được kết quả quiz.'));
    }
  };

  const next = () => {
    stopAudio();
    setVerdict(null);
    setPos((p) => p + 1);
  };

  if (questions.length === 0) {
    return (
      <PracticeShell eyebrow={`Quiz · ${set.title}`} title="Chưa đủ nội dung để làm quiz">
        <p className={s.muted}>
          {isManual
            ? 'Bài học này đang dùng chế độ quiz thủ công nhưng chưa có câu hỏi nào.'
            : 'Bài này cần thêm từ vựng (ít nhất 4 nghĩa khác nhau) để tạo câu hỏi.'}
        </p>
        {set.words.length > 0 ? (
          <LinkButton href={practiceRoutes.flashcards(src)} variant="outline">
            Ôn bằng flashcard
          </LinkButton>
        ) : (
          <LinkButton href={practiceRoutes.hub} variant="outline">
            Về Ôn tập
          </LinkButton>
        )}
      </PracticeShell>
    );
  }

  if (done) {
    return (
      <PracticeShell eyebrow={`Quiz · ${set.title}`} title="Xong bài quiz">
        <section className={s.panel} aria-live="polite">
          <span className={s.score}>
            {score}/{questions.length}
          </span>
          <p className={s.question}>
            Bạn đúng {score} / {questions.length} câu.
          </p>
          {wrongWords.length > 0 && (
            <p className={s.muted}>
              {wrongWords.length} từ cần ôn thêm:{' '}
              {wrongWords.map((w) => `${w.hanzi} ${w.pinyin}`).join(', ')}.
            </p>
          )}
          <div className={s.row}>
            {wrongWords.length > 0 && (
              <LinkButton href={user ? practiceRoutes.flashcards({ due: true }) : practiceRoutes.flashcards(src)} variant="ink">
                Ôn {wrongWords.length} từ sai bằng flashcard
              </LinkButton>
            )}
            <Button variant="outline" onClick={onRestart}>
              Làm lại quiz
            </Button>
            <LinkButton href={practiceRoutes.hub} variant="outline">
              Về Ôn tập
            </LinkButton>
          </div>
        </section>
      </PracticeShell>
    );
  }

  const q = questions[pos];
  return (
    <PracticeShell
      eyebrow={`Quiz · ${set.title}`}
      title="Kiểm tra từ vựng"
      aside={
        <span className={s.count}>
          Câu {pos + 1} / {questions.length}
        </span>
      }
    >
      <section className={s.panel}>
        {q.kind === 'choice' && <Choice key={pos} q={q} locked={!!verdict} onAnswer={record} />}
        {q.kind === 'listen' && <Listen key={pos} q={q} locked={!!verdict} onAnswer={record} />}
        {q.kind === 'order' && <Order key={pos} q={q} locked={!!verdict} onAnswer={record} />}
        {q.kind === 'fill' && <Fill key={pos} q={q} locked={!!verdict} onAnswer={record} />}
        {q.kind === 'match' && <Match key={pos} q={q} onAnswer={record} />}

        {verdict && (
          <div className={`${s.feedback} ${verdict.right ? s.feedbackRight : s.feedbackWrong}`} role="status">
            {verdict.text}
          </div>
        )}
        {verdict && (
          <div>
            <Button variant="ink" onClick={next} autoFocus>
              {pos + 1 < questions.length ? 'Câu tiếp' : 'Xem kết quả'}
            </Button>
          </div>
        )}
      </section>
    </PracticeShell>
  );
}

type OnAnswer = (right: boolean, words: PracticeWord[], text: string) => void;
const explain = (w: PracticeWord) => `${w.hanzi} ${w.pinyin} (${w.meaningVi})`;

function Choice({ q, locked, onAnswer }: { q: Extract<Question, { kind: 'choice' }>; locked: boolean; onAnswer: OnAnswer }) {
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (locked) return;
    setPicked(i);
    const right = i === q.answer;
    const detail = q.explanation || (q.word ? explain(q.word) : q.options[q.answer]);
    onAnswer(
      right,
      q.word ? [q.word] : [],
      right ? `Chính xác. ${detail}.` : `Chưa đúng. Đáp án: ${detail}.`,
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) pick(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <p className={s.type}>Dạng 1 · Chọn đáp án</p>
      <p className={s.question}>
        {q.prompt ? (
          q.prompt
        ) : q.word ? (
          <>
            “<span className="han" lang="zh-CN">{q.word.hanzi}</span>” nghĩa là gì?
          </>
        ) : (
          'Chọn đáp án đúng'
        )}
      </p>
      <ul className={s.options}>
        {q.options.map((opt, i) => (
          <li key={`${opt}-${i}`}>
            <button
              type="button"
              className={s.option}
              disabled={locked}
              data-state={locked ? (i === q.answer ? 'right' : i === picked ? 'wrong' : undefined) : undefined}
              onClick={() => pick(i)}
            >
              <span className={s.key} aria-hidden="true">
                {locked && i === q.answer ? '✓' : i + 1}
              </span>
              {opt}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Listen({ q, locked, onAnswer }: { q: Extract<Question, { kind: 'listen' }>; locked: boolean; onAnswer: OnAnswer }) {
  const { show: showToast } = useToast();
  const [picked, setPicked] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = useCallback(
    async (silent = false) => {
      setPlaying(true);
      const ok = await playWordAudio({
        audioPath: q.audioPath,
        text: q.ttsText ?? q.word?.hanzi ?? null,
      });
      setPlaying(false);
      if (!ok && !silent) {
        showToast('Không phát được âm thanh trên thiết bị này.');
      }
    },
    [q.audioPath, q.ttsText, q.word?.hanzi, showToast],
  );

  // Attempt one automatic playback when the question appears; ignore browser autoplay blocks.
  useEffect(() => {
    void play(true);
    return () => stopAudio();
  }, [play]);

  const pick = (i: number) => {
    if (locked) return;
    setPicked(i);
    const right = i === q.answer;
    const detail = q.explanation || (q.word ? explain(q.word) : q.options[q.answer]);
    onAnswer(
      right,
      q.word ? [q.word] : [],
      right ? `Chính xác. ${detail}.` : `Chưa đúng. Đáp án: ${detail}.`,
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void play(false);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) pick(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <p className={s.type}>Dạng 5 · Nghe và chọn đáp án</p>
      <p className={s.question}>{q.prompt || 'Nghe phát âm và chọn đáp án đúng'}</p>
      <div className={s.listenBar}>
        <Button type="button" variant="ink" data-vocabulary-id={q.word?.id} onClick={() => void play(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
          {playing ? 'Đang phát...' : 'Nghe phát âm'}
        </Button>
        <span className={s.muted}>
          {q.audioPath ? 'Âm thanh của bài học' : 'Giọng đọc tiếng Trung'} · Nhấn phím R để nghe lại
        </span>
      </div>
      <ul className={s.options}>
        {q.options.map((opt, i) => (
          <li key={`${opt}-${i}`}>
            <button
              type="button"
              className={s.option}
              disabled={locked}
              data-state={locked ? (i === q.answer ? 'right' : i === picked ? 'wrong' : undefined) : undefined}
              onClick={() => pick(i)}
            >
              <span className={s.key} aria-hidden="true">
                {locked && i === q.answer ? '✓' : i + 1}
              </span>
              {opt}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Order({ q, locked, onAnswer }: { q: Extract<Question, { kind: 'order' }>; locked: boolean; onAnswer: OnAnswer }) {
  const [picked, setPicked] = useState<number[]>([]);
  const text = (id: number) => q.pieces.find((p) => p.id === id)!.text;

  const check = () => {
    const right = orderIsRight(q, picked);
    const meaning = q.meaningVi || q.word?.exampleVi;
    const okText = q.word?.exampleZh
      ? `Chính xác. ${q.word.exampleZh}${meaning ? ` · ${meaning}` : ''}`
      : `Chính xác. ${q.fullText}${meaning ? ` · ${meaning}` : ''}`;
    const errText = `Chưa đúng. Câu đúng: ${q.fullText}${meaning ? ` (${meaning})` : ''}.`;
    onAnswer(right, q.word ? [q.word] : [], right ? okText : errText);
  };

  return (
    <>
      <p className={s.type}>Dạng 2 · Sắp xếp thành câu</p>
      <p className={s.question}>
        {q.prompt || (q.meaningVi ? `Xếp thành câu “${q.meaningVi}”` : 'Xếp các từ thành câu đúng')}
      </p>
      <div className={s.slots} aria-label="Câu bạn đã xếp" aria-live="polite">
        {picked.length === 0 && <span className={s.muted}>Bấm các từ bên dưới theo đúng thứ tự.</span>}
        {picked.map((id, i) => (
          <button
            key={`${id}-${i}`}
            type="button"
            className={s.chip}
            disabled={locked}
            onClick={() => setPicked((p) => p.filter((_, j) => j !== i))}
            aria-label={`Bỏ ${text(id)}`}
            lang="zh-CN"
          >
            {text(id)}
          </button>
        ))}
      </div>
      <div className={s.row}>
        {q.pieces.map((p) => (
          <button
            key={p.id}
            type="button"
            className={s.chip}
            disabled={locked || picked.includes(p.id)}
            onClick={() => setPicked((x) => [...x, p.id])}
            lang="zh-CN"
          >
            {p.text}
          </button>
        ))}
      </div>
      <p className={s.muted}>Bấm từ để thêm, bấm lại để bỏ. Dùng được bằng bàn phím.</p>
      {!locked && (
        <div className={s.row}>
          <Button variant="outline" onClick={() => setPicked([])} disabled={picked.length === 0}>
            Làm lại
          </Button>
          <Button variant="ink" onClick={check} disabled={picked.length !== q.pieces.length}>
            Kiểm tra
          </Button>
        </div>
      )}
    </>
  );
}

function Fill({ q, locked, onAnswer }: { q: Extract<Question, { kind: 'fill' }>; locked: boolean; onAnswer: OnAnswer }) {
  const [typed, setTyped] = useState('');
  const check = () => {
    const right = fillIsRight({ hanzi: q.answerHanzi, pinyin: q.answerPinyin }, typed);
    const detail = q.word
      ? explain(q.word)
      : `${q.answerHanzi}${q.answerPinyin ? ` ${q.answerPinyin}` : ''}`;
    onAnswer(
      right,
      q.word ? [q.word] : [],
      right ? `Chính xác. ${detail}.` : `Chưa đúng. Đáp án: ${detail}.`,
    );
  };
  return (
    <>
      <p className={s.type}>Dạng 3 · Điền từ</p>
      <p className={s.question}>{q.prompt || 'Điền từ còn thiếu'}</p>
      <p className={`han ${s.question}`} lang="zh-CN" style={{ fontWeight: 600 }}>
        {q.before}
        <span aria-label="chỗ trống"> ___ </span>
        {q.after}
      </p>
      {q.meaningVi && <p className={s.muted}>{q.meaningVi}</p>}
      <form
        className={s.row}
        onSubmit={(e) => {
          e.preventDefault();
          if (!locked && typed.trim()) check();
        }}
      >
        <label htmlFor="fill-answer" className="sr-only">
          Từ còn thiếu
        </label>
        <Input
          id="fill-answer"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Gõ chữ Hán hoặc pinyin"
          disabled={locked}
          autoComplete="off"
          style={{ maxWidth: 280 }}
          autoFocus
        />
        {!locked && (
          <Button type="submit" variant="ink" disabled={!typed.trim()}>
            Kiểm tra
          </Button>
        )}
      </form>
    </>
  );
}

function Match({ q, onAnswer }: { q: Extract<Question, { kind: 'match' }>; onAnswer: OnAnswer }) {
  const [left, setLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const pickRight = (id: string) => {
    if (!left || matched.includes(id)) return;
    if (id === left) {
      const nextMatched = [...matched, id];
      setMatched(nextMatched);
      setLeft(null);
      if (nextMatched.length === q.pairs.length) {
        const wrong = q.pairs.filter((p) => missed.includes(p.id));
        onAnswer(
          wrong.length === 0,
          q.words,
          wrong.length === 0
            ? `Chính xác, nối đúng cả ${q.pairs.length} cặp.`
            : `Đã nối xong, nhưng nhầm ở: ${wrong.map((p) => p.left).join(', ')}.`,
        );
      }
    } else {
      setMissed((m) => (m.includes(left) ? m : [...m, left]));
      setFlash(id);
      setTimeout(() => setFlash(null), 600);
    }
  };

  return (
    <>
      <p className={s.type}>Dạng 4 · Nối cặp</p>
      <p className={s.question}>{q.prompt || 'Nối chữ Hán với nghĩa'}</p>
      <div className={s.pairs}>
        <div className={s.pairCol}>
          {q.pairs.map((p) => (
            <button
              key={p.id}
              type="button"
              className={s.option}
              aria-pressed={left === p.id}
              data-state={matched.includes(p.id) ? 'right' : undefined}
              disabled={matched.includes(p.id)}
              onClick={() => setLeft(p.id)}
              lang="zh-CN"
            >
              <span className="han" style={{ fontSize: 22 }}>
                {p.left}
              </span>
            </button>
          ))}
        </div>
        <div className={s.pairCol}>
          {q.meanings.map((m) => (
            <button
              key={m.id}
              type="button"
              className={s.option}
              data-state={matched.includes(m.id) ? 'right' : flash === m.id ? 'wrong' : undefined}
              disabled={matched.includes(m.id)}
              onClick={() => pickRight(m.id)}
            >
              {m.text}
            </button>
          ))}
        </div>
      </div>
      <p className={s.muted}>Chọn một ô bên trái rồi một ô bên phải. Cặp đúng chuyển màu xanh và khoá lại.</p>
    </>
  );
}
