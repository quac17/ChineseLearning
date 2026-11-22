'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, LinkButton, Skeleton, useToast } from '@/components/ui';
import { PracticeHub, PracticeShell, SetState, usePracticeSet, usePracticeSource } from '@/components/practice/shared';
import s from '@/components/practice/practice.module.css';
import { useAuth } from '@/context/AuthContext';
import { practiceRoutes, saveReviews, type PracticeSource, type PracticeWord } from '@/lib/practice';
import { speakChinese } from '@/lib/speech';

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<Skeleton height={320} />}>
      <Flashcards />
    </Suspense>
  );
}

function Flashcards() {
  const src = usePracticeSource();
  if (!src) return <PracticeHub />;
  return <Session key={'due' in src ? 'due' : src.lessonId} src={src} />;
}

function Session({ src }: { src: PracticeSource }) {
  const { set, error } = usePracticeSet(src);
  const [deck, setDeck] = useState<PracticeWord[] | null>(null);

  useEffect(() => {
    if (set) setDeck(set.words);
  }, [set]);

  if (!set || !deck || deck.length === 0) return <SetState set={set} error={error} eyebrow="Flashcard" />;
  return <Deck key={deck.map((w) => w.id).join()} title={set.title} words={deck} src={src} onAgain={setDeck} />;
}

function Deck({
  title,
  words,
  src,
  onAgain,
}: {
  title: string;
  words: PracticeWord[];
  src: PracticeSource;
  onAgain: (words: PracticeWord[]) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [forgot, setForgot] = useState<PracticeWord[]>([]);
  const done = pos >= words.length;
  const word = words[Math.min(pos, words.length - 1)];

  const answer = useCallback(
    (remembered: boolean) => {
      if (done) return;
      saveReviews(Boolean(user), [{ vocabularyId: word.id, outcome: remembered ? 'remembered' : 'forgot' }]).catch(() =>
        toast.show('Không lưu được kết quả ôn tập.'),
      );
      if (!remembered) setForgot((f) => [...f, word]);
      setFlipped(false);
      setPos((p) => p + 1);
    },
    [done, word, user, toast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || (e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.key === 'Enter') return;
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft') answer(false);
      else if (e.key === 'ArrowRight') answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, done]);

  if (done) {
    const remembered = words.length - forgot.length;
    return (
      <PracticeShell eyebrow={`Flashcard · ${title}`} title="Xong lượt ôn">
        <section className={s.panel} aria-live="polite">
          <p className={s.question}>
            Bạn nhớ {remembered} / {words.length} từ.
          </p>
          {forgot.length > 0 && (
            <p className={s.muted}>
              {forgot.length} từ chưa nhớ ({forgot.map((w) => w.hanzi).join(', ')}) sẽ quay lại ở lượt sau.
            </p>
          )}
          {!user && <p className={s.muted}>Đăng nhập để lưu kết quả và ôn lại đúng hạn.</p>}
          <div className={s.row}>
            {forgot.length > 0 && (
              <Button variant="ink" onClick={() => onAgain(forgot)}>
                Ôn lại {forgot.length} từ
              </Button>
            )}
            {'lessonId' in src && (
              <LinkButton href={practiceRoutes.quiz(src)} variant="outline">
                Làm quiz bài này
              </LinkButton>
            )}
            <LinkButton href={practiceRoutes.hub} variant="outline">
              Về Ôn tập
            </LinkButton>
          </div>
        </section>
      </PracticeShell>
    );
  }

  return (
    <PracticeShell
      eyebrow={`Flashcard · ${title}`}
      title={'due' in src ? 'Ôn từ đến hạn' : 'Lật thẻ'}
      aside={
        <span className={s.count} aria-live="polite">
          {pos + 1} / {words.length}
        </span>
      }
    >
      <button
        type="button"
        className={s.cardButton}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? `Mặt sau: ${word.pinyin}, ${word.meaningVi}. Bấm để lật lại.` : `Mặt trước: ${word.hanzi}. Bấm để lật.`}
      >
        <span className={s.side}>{flipped ? 'Mặt sau' : 'Mặt trước'}</span>
        <span className={`han ${s.bigHan}`} lang="zh-CN">
          {word.hanzi}
        </span>
        {flipped && (
          <>
            <span className={s.pinyinBig}>{word.pinyin}</span>
            <span className={s.meaningBig}>{word.meaningVi}</span>
            {word.exampleZh && (
              <span className={s.exampleBox}>
                <span className="han" lang="zh-CN">
                  {word.exampleZh}
                </span>
                {word.exampleVi && (
                  <>
                    <br />
                    <span className={s.muted}>{word.exampleVi}</span>
                  </>
                )}
              </span>
            )}
          </>
        )}
      </button>
      <p className={s.hint}>Bấm vào thẻ hoặc phím Space để lật. Phím ← chưa nhớ, → đã nhớ.</p>
      <div className={s.row} style={{ justifyContent: 'center' }}>
        <Button variant="subtle" size="sm" onClick={() => speakChinese(word.hanzi) || toast.show('Thiết bị này chưa có giọng đọc tiếng Trung.')}>
          Nghe phát âm
        </Button>
      </div>
      <div className={s.answers}>
        <Button variant="outline" size="lg" onClick={() => answer(false)}>
          Chưa nhớ · ôn lại
        </Button>
        <Button variant="ink" size="lg" onClick={() => answer(true)}>
          Đã nhớ
        </Button>
      </div>
    </PracticeShell>
  );
}
