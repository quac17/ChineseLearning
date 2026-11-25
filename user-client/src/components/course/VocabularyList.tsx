'use client';

import { useEffect, useState } from 'react';
import { Alert, LinkButton, Skeleton, useToast } from '@/components/ui';
import { practiceRoutes } from '@/lib/practice';
import { apiRequest } from '@/lib/api';
import { canSpeakChinese, playWordAudio, speakChinese } from '@/lib/speech';
import type { VocabularyItem } from '@/lib/types';
import s from './vocabulary.module.css';

/** The words of one lesson: 汉字 · pinyin · nghĩa, with an example and a "nghe" button. */
export function VocabularyList({ lessonId }: { lessonId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<VocabularyItem[] | null>(null);
  const [error, setError] = useState('');
  const [voice, setVoice] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError('');
    apiRequest<VocabularyItem[]>(`/lessons/${encodeURIComponent(lessonId)}/vocabulary`)
      .then((data) => !cancelled && setItems(data))
      .catch((err: Error) => !cancelled && setError(err.message || 'Không tải được từ vựng.'));
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  useEffect(() => {
    setVoice(canSpeakChinese());
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const onVoices = () => setVoice(canSpeakChinese());
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoices);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', onVoices);
  }, []);

  const sayWord = async (w: VocabularyItem) => {
    const ok = await playWordAudio({ audioPath: w.audioPath, text: w.hanzi });
    if (!ok) toast.show('Thiết bị này chưa có giọng đọc tiếng Trung.');
  };

  const say = (text: string) => {
    if (!speakChinese(text)) toast.show('Thiết bị này chưa có giọng đọc tiếng Trung.');
  };

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!items) {
    return (
      <div className={s.grid} aria-busy="true" aria-label="Đang tải từ vựng">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={132} />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <p className={s.muted}>Bài học này chưa có từ vựng.</p>;

  return (
    <>
      <ul className={s.grid}>
        {items.map((w) => (
          <li key={w.id} className={s.card}>
            <div className={s.top}>
              <span className={`han ${s.hanzi}`} lang="zh-CN">
                {w.hanzi}
              </span>
              {(voice || w.audioPath) && (
                <button
                  type="button"
                  className={s.speak}
                  onClick={() => void sayWord(w)}
                  aria-label={`Nghe phát âm ${w.hanzi}`}
                >
                  <SpeakerIcon />
                </button>
              )}
            </div>
            <b className={s.pinyin}>{w.pinyin}</b>
            <span className={s.meaning}>{w.meaningVi}</span>
            {w.exampleZh && (
              <span className={s.example}>
                <span className="han" lang="zh-CN">
                  {w.exampleZh}
                </span>
                {voice && (
                  <button
                    type="button"
                    className={s.speakSmall}
                    onClick={() => say(w.exampleZh!)}
                    aria-label={`Nghe câu ví dụ ${w.exampleZh}`}
                  >
                    <SpeakerIcon size={14} />
                  </button>
                )}
                {w.exampleVi && <span className={s.exampleVi}>{w.exampleVi}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
      {!voice && <p className={s.muted}>Thiết bị này chưa có giọng đọc tiếng Trung nên không phát âm được.</p>}
      <div className={s.practice}>
        <LinkButton href={practiceRoutes.flashcards({ lessonId })} variant="outline" size="sm">
          Ôn {items.length} từ bằng flashcard
        </LinkButton>
        <LinkButton href={practiceRoutes.quiz({ lessonId })} variant="outline" size="sm">
          Quiz
        </LinkButton>
        <LinkButton href={practiceRoutes.writing({ lessonId })} variant="outline" size="sm">
          Luyện viết
        </LinkButton>
      </div>
    </>
  );
}

function SpeakerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
