import {
  looseAnswer,
  shuffle,
  type PracticeManualQuizQuestion,
  type PracticeSet,
  type PracticeWord,
} from './practice';
import type {
  ChoiceQuizPayload,
  FillQuizPayload,
  ListenQuizPayload,
  MatchQuizPayload,
  OrderQuizPayload,
} from './types';

/**
 * Quiz questions (auto-generated from vocabulary or manually authored per lesson):
 *   1. choice: "<汉字> nghĩa là gì?" (or custom prompt) with 2–6 options,
 *   2. listen: play word audio (custom override or TTS), pick the matching option,
 *   3. order:  put sentence pieces back together in order,
 *   4. fill:   sentence with the target word blanked out,
 *   5. match:  pair left items (Hanzi) with right items (meanings).
 */
export type Question =
  | {
      kind: 'choice';
      prompt?: string;
      word?: PracticeWord;
      options: string[];
      answer: number;
      explanation?: string;
    }
  | {
      kind: 'listen';
      prompt?: string;
      word?: PracticeWord;
      audioPath?: string | null;
      ttsText?: string | null;
      options: string[];
      answer: number;
      explanation?: string;
    }
  | {
      kind: 'order';
      prompt?: string;
      word?: PracticeWord;
      meaningVi?: string;
      pieces: Array<{ id: number; text: string }>;
      answer: number[];
      fullText: string;
    }
  | {
      kind: 'fill';
      prompt?: string;
      word?: PracticeWord;
      before: string;
      after: string;
      answerHanzi: string;
      answerPinyin?: string;
      meaningVi?: string;
    }
  | {
      kind: 'match';
      prompt?: string;
      words: PracticeWord[];
      pairs: Array<{ id: string; left: string; right: string }>;
      meanings: Array<{ id: string; text: string }>;
    };

const PUNCT = /[，。！？、；：,.!?;:“”"'（）()\s]/g;

/** Greedy longest-match split of `sentence` on known words, else single characters. */
export function segment(sentence: string, known: string[]): string[] {
  const text = sentence.replace(PUNCT, '');
  const words = [...new Set(known.filter((w) => w.length > 0))].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const hit = words.find((w) => text.startsWith(w, i));
    const piece = hit ?? text[i];
    out.push(piece);
    i += piece.length;
  }
  return out;
}

function shufflePieces(parts: string[]): { pieces: Array<{ id: number; text: string }>; answer: number[] } {
  const pieces = parts.map((text, id) => ({ id, text }));
  let shuffled = shuffle(pieces);
  // Never hand out the pieces already in order when there are at least 2 distinct pieces.
  for (let t = 0; t < 5 && shuffled.every((p, i) => p.id === i); t++) shuffled = shuffle(pieces);
  return { pieces: shuffled, answer: pieces.map((p) => p.id) };
}

/** Auto-generates up to `max` quiz questions from the lesson's vocabulary words. */
export function buildQuiz(set: PracticeSet, max = 10): Question[] {
  const words = shuffle(set.words);
  const known = [...set.words.map((w) => w.hanzi), ...set.pool.map((p) => p.hanzi)];
  const meanings = [...new Set([...set.words, ...set.pool].map((w) => w.meaningVi))];
  const questions: Question[] = [];

  if (set.words.length >= 4) {
    const four = words.slice(0, 4);
    questions.push({
      kind: 'match',
      words: four,
      pairs: four.map((w) => ({ id: w.id, left: w.hanzi, right: w.meaningVi })),
      meanings: shuffle(four.map((w) => ({ id: w.id, text: w.meaningVi }))),
    });
  }

  const kinds: Array<'choice' | 'listen' | 'order' | 'fill'> = ['choice', 'listen', 'order', 'fill'];
  words.forEach((word, i) => {
    if (questions.length >= max) return;
    // Rotate all 4 per-word types, falling back to "choice" when a word has no usable example.
    const preferred = kinds[i % kinds.length];
    const q = makeQuestion(word, preferred, known, meanings) ?? makeQuestion(word, 'choice', known, meanings);
    if (q) questions.push(q);
  });
  return shuffle(questions).slice(0, max);
}

function makeQuestion(
  word: PracticeWord,
  kind: 'choice' | 'listen' | 'order' | 'fill',
  known: string[],
  meanings: string[],
): Question | null {
  if (kind === 'choice' || kind === 'listen') {
    const others = shuffle(meanings.filter((m) => m !== word.meaningVi)).slice(0, 3);
    if (others.length < 3) return null;
    const options = shuffle([word.meaningVi, ...others]);
    const answer = options.indexOf(word.meaningVi);
    if (kind === 'listen') {
      return {
        kind: 'listen',
        word,
        audioPath: word.audioPath ?? null,
        ttsText: word.hanzi,
        options,
        answer,
      };
    }
    return { kind: 'choice', word, options, answer };
  }
  const sentence = word.exampleZh?.trim();
  if (!sentence || !sentence.includes(word.hanzi)) return null;
  if (kind === 'fill') {
    const at = sentence.indexOf(word.hanzi);
    return {
      kind: 'fill',
      word,
      before: sentence.slice(0, at),
      after: sentence.slice(at + word.hanzi.length),
      answerHanzi: word.hanzi,
      answerPinyin: word.pinyin,
      meaningVi: word.exampleVi ?? undefined,
    };
  }
  const parts = segment(sentence, known);
  if (parts.length < 3 || parts.length > 8) return null;
  const { pieces, answer } = shufflePieces(parts);
  return {
    kind: 'order',
    word,
    meaningVi: word.exampleVi || word.meaningVi,
    pieces,
    answer,
    fullText: parts.join(''),
  };
}

/** Builds playable Question items from a teacher's manually authored lesson quiz questions. */
export function buildManualQuiz(manualQuestions: PracticeManualQuizQuestion[], words: PracticeWord[]): Question[] {
  const wordById = new Map(words.map((w) => [w.id, w]));
  const out: Question[] = [];

  for (const mq of manualQuestions) {
    const word = mq.vocabularyId ? wordById.get(mq.vocabularyId) : undefined;
    switch (mq.kind) {
      case 'choice': {
        const p = mq.payload as ChoiceQuizPayload;
        if (!Array.isArray(p.options) || p.options.length < 2) break;
        out.push({
          kind: 'choice',
          prompt: mq.prompt ?? undefined,
          word,
          options: p.options,
          answer: Math.min(Math.max(0, p.correctIndex ?? 0), p.options.length - 1),
          explanation: p.explanation,
        });
        break;
      }
      case 'listen': {
        const p = mq.payload as ListenQuizPayload;
        if (!Array.isArray(p.options) || p.options.length < 2) break;
        out.push({
          kind: 'listen',
          prompt: mq.prompt ?? undefined,
          word,
          audioPath: mq.audioPath ?? word?.audioPath ?? null,
          ttsText: mq.ttsText || p.ttsText || word?.hanzi || null,
          options: p.options,
          answer: Math.min(Math.max(0, p.correctIndex ?? 0), p.options.length - 1),
          explanation: p.explanation,
        });
        break;
      }
      case 'order': {
        const p = mq.payload as OrderQuizPayload;
        if (!Array.isArray(p.pieces) || p.pieces.length < 2) break;
        const { pieces, answer } = shufflePieces(p.pieces);
        out.push({
          kind: 'order',
          prompt: mq.prompt ?? undefined,
          word,
          meaningVi: p.meaningVi || word?.exampleVi || word?.meaningVi,
          pieces,
          answer,
          fullText: p.pieces.join(''),
        });
        break;
      }
      case 'fill': {
        const p = mq.payload as FillQuizPayload;
        if (!p.answerHanzi?.trim()) break;
        out.push({
          kind: 'fill',
          prompt: mq.prompt ?? undefined,
          word,
          before: p.before ?? '',
          after: p.after ?? '',
          answerHanzi: p.answerHanzi,
          answerPinyin: p.answerPinyin ?? word?.pinyin,
          meaningVi: p.meaningVi ?? word?.exampleVi ?? undefined,
        });
        break;
      }
      case 'match': {
        const p = mq.payload as MatchQuizPayload;
        if (!Array.isArray(p.pairs) || p.pairs.length < 2) break;
        const pairs = p.pairs.map((pair, idx) => ({
          id: `${mq.id}-${idx}`,
          left: pair.left,
          right: pair.right,
        }));
        out.push({
          kind: 'match',
          prompt: mq.prompt ?? undefined,
          words: word ? [word] : [],
          pairs,
          meanings: shuffle(pairs.map((pair) => ({ id: pair.id, text: pair.right }))),
        });
        break;
      }
    }
  }

  return out;
}

/** A fill-in answer is right as Hanzi or as pinyin (tones and spaces optional). */
export function fillIsRight(target: { hanzi: string; pinyin?: string | null }, typed: string): boolean {
  const t = typed.trim();
  if (!t) return false;
  if (t === target.hanzi) return true;
  if (target.pinyin && looseAnswer(t) === looseAnswer(target.pinyin)) return true;
  return false;
}

/** Order answers compare by text, so repeated pieces (我…我) may swap places. */
export function orderIsRight(q: Extract<Question, { kind: 'order' }>, picked: number[]): boolean {
  const text = (ids: number[]) => ids.map((id) => q.pieces.find((p) => p.id === id)?.text ?? '').join('');
  return picked.length === q.answer.length && text(picked) === text(q.answer);
}
