'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Button, Input, LinkButton, Skeleton, useToast } from '@/components/ui';
import { PracticeHub, PracticeShell, SetState, usePracticeSet, usePracticeSource } from '@/components/practice/shared';
import s from '@/components/practice/practice.module.css';
import { useAuth } from '@/context/AuthContext';
import { practiceRoutes, saveReviews, type PracticeSet, type PracticeSource, type PracticeWord } from '@/lib/practice';
import { buildQuiz, fillIsRight, orderIsRight, type Question } from '@/lib/quiz';

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
  if (!set || set.words.length === 0) return <SetState set={set} error={error} eyebrow="Quiz" />;
  return <Quiz key={round} set={set} src={src} onRestart={() => setRound((r) => r + 1)} />;
}

type Verdict = { right: boolean; text: string } | null;

function Quiz({ set, src, onRestart }: { set: PracticeSet; src: PracticeSource; onRestart: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const questions = useMemo(() => buildQuiz(set), [set]);
  const [pos, setPos] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [score, setScore] = useState(0);
  const [wrongWords, setWrongWords] = useState<PracticeWord[]>([]);
  const done = pos >= questions.length;

  const record = (right: boolean, words: PracticeWord[], text: string) => {
    if (right) setScore((n) => n + 1);
    else setWrongWords((w) => [...w, ...words.filter((x) => !w.some((y) => y.id === x.id))]);
    setVerdict({ right, text });
    saveReviews(
      Boolean(user),
      words.map((w) => ({ vocabularyId: w.id, outcome: right ? 'quiz_correct' : 'quiz_wrong' })),
    ).catch(() => toast.show('Không lưu được kết quả quiz.'));
  };

  const next = () => {
    setVerdict(null);
    setPos((p) => p + 1);
  };

  if (questions.length === 0) {
    return (
      <PracticeShell eyebrow={`Quiz · ${set.title}`} title="Chưa đủ từ để làm quiz">
        <p className={s.muted}>Bài này cần thêm từ vựng (ít nhất 4 nghĩa khác nhau) để tạo câu hỏi.</p>
        <LinkButton href={practiceRoutes.flashcards(src)} variant="outline">
          Ôn bằng flashcard
        </LinkButton>
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
    onAnswer(right, [q.word], right ? `Chính xác. ${explain(q.word)}.` : `Chưa đúng. Đáp án: ${explain(q.word)}.`);
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
        “<span className="han" lang="zh-CN">{q.word.hanzi}</span>” nghĩa là gì?
      </p>
      <ul className={s.options}>
        {q.options.map((opt, i) => (
          <li key={opt}>
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
  const full = q.answer.map(text).join('');

  const check = () => {
    const right = orderIsRight(q, picked);
    onAnswer(
      right,
      [q.word],
      right ? `Chính xác. ${q.word.exampleZh}${q.word.exampleVi ? ` · ${q.word.exampleVi}` : ''}` : `Chưa đúng. Câu đúng: ${full}${q.word.exampleVi ? ` (${q.word.exampleVi})` : ''}.`,
    );
  };

  return (
    <>
      <p className={s.type}>Dạng 2 · Sắp xếp thành câu</p>
      <p className={s.question}>Xếp thành câu “{q.word.exampleVi || q.word.meaningVi}”</p>
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
    const right = fillIsRight(q.word, typed);
    onAnswer(right, [q.word], right ? `Chính xác. ${explain(q.word)}.` : `Chưa đúng. Đáp án: ${explain(q.word)}.`);
  };
  return (
    <>
      <p className={s.type}>Dạng 3 · Điền từ</p>
      <p className={s.question}>Điền từ còn thiếu</p>
      <p className={`han ${s.question}`} lang="zh-CN" style={{ fontWeight: 600 }}>
        {q.before}
        <span aria-label="chỗ trống"> ___ </span>
        {q.after}
      </p>
      {q.word.exampleVi && <p className={s.muted}>{q.word.exampleVi}</p>}
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
      if (nextMatched.length === q.words.length) {
        const wrong = q.words.filter((w) => missed.includes(w.id));
        onAnswer(
          wrong.length === 0,
          q.words,
          wrong.length === 0 ? 'Chính xác, nối đúng cả 4 cặp.' : `Đã nối xong, nhưng nhầm ở: ${wrong.map((w) => w.hanzi).join(', ')}.`,
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
      <p className={s.question}>Nối chữ Hán với nghĩa</p>
      <div className={s.pairs}>
        <div className={s.pairCol}>
          {q.words.map((w) => (
            <button
              key={w.id}
              type="button"
              className={s.option}
              aria-pressed={left === w.id}
              data-state={matched.includes(w.id) ? 'right' : undefined}
              disabled={matched.includes(w.id)}
              onClick={() => setLeft(w.id)}
              lang="zh-CN"
            >
              <span className="han" style={{ fontSize: 22 }}>
                {w.hanzi}
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
