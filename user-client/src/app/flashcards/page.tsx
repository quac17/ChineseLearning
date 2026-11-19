'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useModule } from '@/context/ModuleContext';
import { DEMO_FLASHCARDS } from '@/lib/modules';

function shuffleIndices(arr: number[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function FlashcardsContent() {
  const searchParams = useSearchParams();
  const initialDeck = searchParams.get('deck');
  const { activeModule } = useModule();

  const decks = useMemo(
    () => DEMO_FLASHCARDS.filter((d) => activeModule === 'all' || d.module === activeModule),
    [activeModule],
  );

  const [deckId, setDeckId] = useState<string>(initialDeck || decks[0]?.id || '');
  const deck = decks.find((d) => d.id === deckId) || decks[0] || null;

  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!deck) return;
    setDeckId(deck.id);
    setOrder(deck.cards.map((_, i) => i));
    setPos(0);
    setFlipped(false);
    try {
      const saved = JSON.parse(localStorage.getItem(`known:${deck.id}`) || '[]');
      setKnown(new Set(Array.isArray(saved) ? saved : []));
    } catch {
      setKnown(new Set());
    }
  }, [deck?.id]);

  if (!deck) {
    return (
      <>
        <h2 style={{ marginTop: 0 }}>Flashcard</h2>
        <p className="hint">Chưa có bộ thẻ nào cho chương trình này.</p>
      </>
    );
  }

  const cardIndex = order[pos] ?? 0;
  const card = deck.cards[cardIndex];

  const markKnown = () => {
    const next = new Set(known);
    next.add(cardIndex);
    setKnown(next);
    try {
      localStorage.setItem(`known:${deck.id}`, JSON.stringify(Array.from(next)));
    } catch {
      // ignore storage errors
    }
    setPos((pos + 1) % order.length);
    setFlipped(false);
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Flashcard từ vựng</h2>
      <div className="row" style={{ margin: '0 0 14px' }}>
        {decks.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`btn ${d.id === deck.id ? '' : 'alt'}`}
            onClick={() => setDeckId(d.id)}
          >
            {d.title}
          </button>
        ))}
      </div>

      <div className="deck">
        <div>
          <div className="nums">
            {order.map((ix, p) => (
              <button
                key={`${ix}-${p}`}
                type="button"
                className={`${p === pos ? 'on' : ''} ${known.has(ix) ? 'ok' : ''}`}
                onClick={() => {
                  setPos(p);
                  setFlipped(false);
                }}
              >
                {ix + 1}
              </button>
            ))}
          </div>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setOrder(shuffleIndices(order));
                setPos(0);
                setFlipped(false);
              }}
            >
              Xáo trộn
            </button>
            <button
              type="button"
              className="btn alt"
              onClick={() => {
                setOrder(deck.cards.map((_, i) => i));
                setPos(0);
                setFlipped(false);
              }}
            >
              Thứ tự gốc
            </button>
          </div>
        </div>

        <div>
          <div
            className={`fc ${flipped ? 'flip' : ''}`}
            onClick={() => setFlipped((prev) => !prev)}
          >
            <div>
              <div className="face">
                <div className="big han">{card?.han}</div>
                <small style={{ color: 'var(--mute)' }}>Bấm để lật thẻ</small>
              </div>
              <div className="face back">
                <div className="han" style={{ fontSize: 40 }}>
                  {card?.han}
                </div>
                <div style={{ fontSize: 22, marginTop: 6 }}>{card?.pinyin}</div>
                <div style={{ fontSize: 20, marginTop: 6 }}>{card?.vi}</div>
              </div>
            </div>
          </div>

          <div className="row">
            <button
              type="button"
              className="btn alt"
              onClick={() => {
                setPos((pos + order.length - 1) % order.length);
                setFlipped(false);
              }}
            >
              Trước
            </button>
            <button
              type="button"
              className="btn alt"
              onClick={() => {
                setPos((pos + 1) % order.length);
                setFlipped(false);
              }}
            >
              Sau
            </button>
            <button type="button" className="btn jade" onClick={markKnown}>
              Đã thuộc ({known.size}/{deck.cards.length})
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<p className="hint">Đang tải bộ thẻ...</p>}>
      <FlashcardsContent />
    </Suspense>
  );
}
