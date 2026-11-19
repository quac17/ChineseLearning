'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useModule } from '@/context/ModuleContext';
import { DEMO_QUIZZES, QuizDeck } from '@/lib/modules';

function normalizePinyin(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function QuizRunner({ quiz, onBack }: { quiz: QuizDeck; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [checked, setChecked] = useState<{ ok: boolean; answer: string } | null>(null);

  const q = quiz.questions[index];

  // Question state
  const [selectedChoice, setSelectedChoice] = useState<Set<number>>(new Set());
  const [placedOrder, setPlacedOrder] = useState<Array<[string, number]>>([]);
  const [orderPool, setOrderPool] = useState<Array<[string, number]>>(() =>
    q?.type === 'order' ? shuffle(q.answer.map((w, i) => [w, i])) : [],
  );
  const [fillVal, setFillVal] = useState('');
  const [pairs, setPairs] = useState<Record<number, number>>({});
  const [pickLeft, setPickLeft] = useState<number | null>(null);
  const [rightMap, setRightMap] = useState<number[]>(() =>
    q?.type === 'match' ? shuffle(q.right.map((_, i) => i)) : [],
  );

  const resetForIndex = (nextIdx: number) => {
    const nq = quiz.questions[nextIdx];
    setIndex(nextIdx);
    setChecked(null);
    setSelectedChoice(new Set());
    setPlacedOrder([]);
    setFillVal('');
    setPairs({});
    setPickLeft(null);
    setOrderPool(nq?.type === 'order' ? shuffle(nq.answer.map((w, i) => [w, i])) : []);
    setRightMap(nq?.type === 'match' ? shuffle(nq.right.map((_, i) => i)) : []);
  };

  if (!q) {
    return (
      <div className="q">
        <h3>Hoàn thành bài Quiz!</h3>
        <p style={{ fontSize: 30, margin: '8px 0' }}>
          {score}/{quiz.questions.length} câu đúng
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setScore(0);
              resetForIndex(0);
            }}
          >
            Làm lại
          </button>
          <button type="button" className="btn alt" onClick={onBack}>
            Danh sách quiz
          </button>
        </div>
      </div>
    );
  }

  const handleCheck = () => {
    let ok = false;
    let ans = '';

    if (q.type === 'choice') {
      const target = new Set(q.answer);
      ok =
        target.size === selectedChoice.size &&
        q.answer.every((x) => selectedChoice.has(x));
      ans = q.answer.map((x) => q.options[x]).join(', ');
    } else if (q.type === 'order') {
      ok = placedOrder.map((p) => p[0]).join('|') === q.answer.join('|');
      ans = q.answer.join(' ');
    } else if (q.type === 'fill') {
      const v = fillVal.trim();
      ok = q.answers.some((a) => a.trim() === v || normalizePinyin(a) === normalizePinyin(v));
      ans = q.answers[0];
    } else if (q.type === 'match') {
      ok = q.left.every((_, i) => pairs[i] === q.pairs[i]);
      ans = q.left.map((x, i) => `${x} → ${q.right[q.pairs[i]]}`).join('; ');
    }

    if (ok) setScore((s) => s + 1);
    setChecked({ ok, answer: ans });
  };

  const usedOrderIds = new Set(placedOrder.map((p) => p[1]));

  return (
    <>
      <p style={{ margin: '0 0 8px', color: 'var(--mute)' }}>
        {quiz.title} · Câu {index + 1}/{quiz.questions.length}
      </p>
      <div className="q">
        <h3>{q.q}</h3>
        {q.hint && <div className="hint">{q.hint}</div>}

        {q.type === 'choice' && (
          <div>
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className={`opt ${selectedChoice.has(idx) ? 'sel' : ''}`}
                disabled={Boolean(checked)}
                onClick={() => {
                  if (q.answer.length === 1) {
                    setSelectedChoice(new Set([idx]));
                  } else {
                    const next = new Set(selectedChoice);
                    if (next.has(idx)) next.delete(idx);
                    else next.add(idx);
                    setSelectedChoice(next);
                  }
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.type === 'order' && (
          <div>
            <div className="slot">
              {placedOrder.map((item, idx) => (
                <button
                  key={`${item[1]}-${idx}`}
                  type="button"
                  className="chip han"
                  disabled={Boolean(checked)}
                  onClick={() =>
                    setPlacedOrder((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  {item[0]}
                </button>
              ))}
            </div>
            <div className="row">
              {orderPool
                .filter((p) => !usedOrderIds.has(p[1]))
                .map((item) => (
                  <button
                    key={item[1]}
                    type="button"
                    className="chip han"
                    disabled={Boolean(checked)}
                    onClick={() => setPlacedOrder((prev) => [...prev, item])}
                  >
                    {item[0]}
                  </button>
                ))}
            </div>
          </div>
        )}

        {q.type === 'fill' && (
          <p className="han" style={{ fontSize: 24, margin: '8px 0' }}>
            {q.text.split('___')[0]}
            <input
              className="fill han"
              value={fillVal}
              disabled={Boolean(checked)}
              onChange={(e) => setFillVal(e.target.value)}
              aria-label="Đáp án"
              autoComplete="off"
            />
            {q.text.split('___')[1] || ''}
          </p>
        )}

        {q.type === 'match' && (
          <div className="pair">
            <div>
              {q.left.map((item, li) => (
                <button
                  key={li}
                  type="button"
                  className={`opt ${pairs[li] != null ? `p${li % 3}` : ''} ${
                    pickLeft === li ? 'sel' : ''
                  }`}
                  disabled={Boolean(checked)}
                  onClick={() => setPickLeft(li)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div>
              {rightMap.map((ri) => {
                const owner = Object.keys(pairs).find((k) => pairs[Number(k)] === ri);
                return (
                  <button
                    key={ri}
                    type="button"
                    className={`opt ${owner != null ? `p${Number(owner) % 3}` : ''}`}
                    disabled={Boolean(checked)}
                    onClick={() => {
                      if (pickLeft == null) return;
                      const next = { ...pairs };
                      Object.keys(next).forEach((k) => {
                        if (next[Number(k)] === ri) delete next[Number(k)];
                      });
                      next[pickLeft] = ri;
                      setPairs(next);
                      setPickLeft(null);
                    }}
                  >
                    {q.right[ri]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          {!checked ? (
            <button type="button" className="btn" onClick={handleCheck}>
              Kiểm tra
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => resetForIndex(index + 1)}
            >
              {index === quiz.questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp'}
            </button>
          )}
          <button type="button" className="btn alt" onClick={onBack}>
            Quay lại
          </button>
        </div>

        {checked && (
          <div className="res">
            {checked.ok ? (
              <span className="good">Chính xác!</span>
            ) : (
              <span className="bad">Chưa đúng. Đáp án: {checked.answer}</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function QuizContent() {
  const searchParams = useSearchParams();
  const initialQuizId = searchParams.get('quiz');
  const { activeModule } = useModule();

  const quizzes = useMemo(
    () => DEMO_QUIZZES.filter((q) => activeModule === 'all' || q.module === activeModule),
    [activeModule],
  );

  const [selectedId, setSelectedId] = useState<string>(initialQuizId || '');
  const activeQuiz = quizzes.find((q) => q.id === selectedId) || null;

  if (activeQuiz) {
    return <QuizRunner quiz={activeQuiz} onBack={() => setSelectedId('')} />;
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Quiz ôn tập</h2>
      {quizzes.length === 0 ? (
        <p className="hint">Chưa có bài quiz nào cho chương trình này.</p>
      ) : (
        <div className="lessons">
          {quizzes.map((qz) => (
            <div className="les" key={qz.id}>
              <div className="t">
                <b>{qz.title}</b>
                <br />
                <small>{qz.questions.length} câu hỏi tương tác</small>
              </div>
              <button
                type="button"
                className="btn alt sm"
                onClick={() => setSelectedId(qz.id)}
              >
                Làm bài
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<p className="hint">Đang tải bài quiz...</p>}>
      <QuizContent />
    </Suspense>
  );
}
