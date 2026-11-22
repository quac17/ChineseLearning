'use client';

import type HanziWriterType from 'hanzi-writer';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, LinkButton, Skeleton, useToast } from '@/components/ui';
import { PracticeHub, PracticeShell, SetState, usePracticeSet, usePracticeSource } from '@/components/practice/shared';
import s from '@/components/practice/practice.module.css';
import { practiceRoutes, type PracticeSet, type PracticeSource, type PracticeWord } from '@/lib/practice';
import { speakChinese } from '@/lib/speech';

/**
 * Stroke data for Hanzi Writer, from the hanzi-writer-data package on jsDelivr
 * (pinned version). Derived from Make Me a Hanzi (Arphic Public License);
 * see user-client/THIRD_PARTY.md.
 */
const STROKE_DATA = (char: string) => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(char)}.json`;

export default function WritingPage() {
  return (
    <Suspense fallback={<Skeleton height={320} />}>
      <WritingRoute />
    </Suspense>
  );
}

function WritingRoute() {
  const src = usePracticeSource();
  if (!src) return <PracticeHub focus="writing" />;
  return <Loader key={'due' in src ? 'due' : src.lessonId} src={src} />;
}

function Loader({ src }: { src: PracticeSource }) {
  const { set, error } = usePracticeSet(src);
  if (!set || set.words.length === 0) return <SetState set={set} error={error} eyebrow="Luyện viết" />;
  return <Writing set={set} src={src} />;
}

interface CharItem {
  char: string;
  word: PracticeWord;
}

/** Every distinct Hanzi of the lesson, in order, with the first word that uses it. */
function charsOf(words: PracticeWord[]): CharItem[] {
  const seen = new Map<string, CharItem>();
  for (const word of words) {
    for (const char of Array.from(word.hanzi)) {
      if (/\p{Script=Han}/u.test(char) && !seen.has(char)) seen.set(char, { char, word });
    }
  }
  return [...seen.values()];
}

function Writing({ set, src }: { set: PracticeSet; src: PracticeSource }) {
  const toast = useToast();
  const chars = useMemo(() => charsOf(set.words), [set.words]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const [strokes, setStrokes] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mistakes, setMistakes] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriterType | null>(null);
  const item = chars[index];

  useEffect(() => {
    if (!item || !box.current) return;
    let cancelled = false;
    setStrokes(null);
    setLoadError(false);
    setMistakes(null);
    box.current.innerHTML = '';
    const size = box.current.clientWidth || 300;
    import('hanzi-writer').then(({ default: HanziWriter }) => {
      if (cancelled || !box.current) return;
      const css = getComputedStyle(document.documentElement);
      const color = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      const w = HanziWriter.create(box.current, item.char, {
        width: size,
        height: size,
        padding: 16,
        showOutline: true,
        showCharacter: false,
        strokeColor: color('--ink', '#1c1d1f'),
        outlineColor: color('--line', '#d1d7dc'),
        drawingColor: color('--accent', '#c2321c'),
        highlightColor: color('--focus', '#1f4fa0'),
        drawingWidth: 12,
        charDataLoader: (char, onLoad, onError) => {
          fetch(STROKE_DATA(char))
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then(onLoad)
            .catch(onError);
        },
        onLoadCharDataSuccess: (data) => !cancelled && setStrokes(data.strokes.length),
        onLoadCharDataError: () => !cancelled && setLoadError(true),
      });
      writer.current = w;
      w.quiz({
        onComplete: ({ totalMistakes }) => {
          if (cancelled) return;
          setMistakes(totalMistakes);
          setDone((d) => (d.includes(item.char) ? d : [...d, item.char]));
        },
      });
    });
    return () => {
      cancelled = true;
      writer.current?.cancelQuiz?.();
      writer.current = null;
    };
  }, [item]);

  const restart = () => {
    setMistakes(null);
    writer.current?.quiz({
      onComplete: ({ totalMistakes }) => {
        setMistakes(totalMistakes);
        setDone((d) => (d.includes(item.char) ? d : [...d, item.char]));
      },
    });
  };

  const showOrder = async () => {
    const w = writer.current;
    if (!w) return;
    w.cancelQuiz();
    await w.animateCharacter();
    w.hideCharacter();
    restart();
  };

  if (chars.length === 0) {
    return (
      <PracticeShell eyebrow={`Luyện viết · ${set.title}`} title="Không có chữ Hán để luyện">
        <LinkButton href={practiceRoutes.hub} variant="outline">
          Chọn bài khác
        </LinkButton>
      </PracticeShell>
    );
  }

  return (
    <PracticeShell
      eyebrow={`Luyện viết · ${set.title}`}
      title="Viết theo nét"
      aside={
        <span className={s.count}>
          Chữ {index + 1} / {chars.length}
        </span>
      }
    >
      <div className={s.writeLayout}>
        <div>
          <div
            ref={box}
            className={`${s.grid} ${s.tianzige}`}
            role="img"
            aria-label={`Ô 田字格 để viết chữ ${item.char}`}
          />
        </div>
        <div className={s.writeInfo}>
          <span className={`han ${s.bigHan}`} lang="zh-CN" style={{ fontSize: 56 }}>
            {item.char}
          </span>
          <b>
            <span className="han" lang="zh-CN">
              {item.word.hanzi}
            </span>{' '}
            {item.word.pinyin}
          </b>
          <span>{item.word.meaningVi}</span>
          {strokes !== null && <span className={s.muted}>{strokes} nét</span>}
          {loadError && (
            <Alert tone="warning">Không tải được dữ liệu nét chữ (cần kết nối mạng). Thử lại sau.</Alert>
          )}
          {mistakes !== null && (
            <div className={`${s.feedback} ${mistakes === 0 ? s.feedbackRight : s.feedbackWrong}`} role="status">
              {mistakes === 0 ? 'Viết đúng tất cả các nét.' : `Xong chữ, sai ${mistakes} lần. Viết lại để nhớ nét.`}
            </div>
          )}
          <p className={s.muted}>Viết đè lên chữ mờ, từng nét theo đúng thứ tự. Nét sai sẽ được gợi ý.</p>
          <div className={s.row}>
            <Button variant="outline" size="sm" onClick={restart} disabled={loadError}>
              Xoá
            </Button>
            <Button variant="outline" size="sm" onClick={showOrder} disabled={loadError || strokes === null}>
              Xem thứ tự nét
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => speakChinese(item.char) || toast.show('Thiết bị này chưa có giọng đọc tiếng Trung.')}
            >
              Nghe phát âm
            </Button>
            {index + 1 < chars.length ? (
              <Button variant="ink" size="sm" onClick={() => setIndex((i) => i + 1)}>
                Chữ tiếp
              </Button>
            ) : (
              <LinkButton href={'lessonId' in src ? practiceRoutes.quiz(src) : practiceRoutes.hub} variant="ink" size="sm">
                {'lessonId' in src ? 'Làm quiz bài này' : 'Về Ôn tập'}
              </LinkButton>
            )}
          </div>
          <p className={s.eyebrow} style={{ marginTop: 8 }}>
            Chữ trong bài
          </p>
          <div className={s.charList}>
            {chars.map((c, i) => (
              <button
                key={c.char}
                type="button"
                className={s.charButton}
                aria-current={i === index ? 'true' : undefined}
                data-done={done.includes(c.char) || undefined}
                onClick={() => setIndex(i)}
                lang="zh-CN"
                aria-label={`${c.char}${done.includes(c.char) ? ', đã viết' : ''}`}
              >
                {c.char}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PracticeShell>
  );
}
