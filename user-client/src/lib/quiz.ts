import { looseAnswer, shuffle, type PracticeSet, type PracticeWord } from './practice';

/**
 * Builds a quiz from a lesson's words (agreed design, WebQuiz):
 *   1. choice: "<汉字> nghĩa là gì?" with 4 meanings,
 *   2. order:  put the example sentence back together,
 *   3. fill:   the example sentence with the word blanked out,
 *   4. match:  pair 4 Hanzi with their meanings (one per quiz).
 * Sentences are split on the lesson's own words, else per character; a
 * sentence of more than 8 pieces is not used for "order".
 */
export type Question =
  | { kind: 'choice'; word: PracticeWord; options: string[]; answer: number }
  | { kind: 'order'; word: PracticeWord; pieces: Array<{ id: number; text: string }>; answer: number[] }
  | { kind: 'fill'; word: PracticeWord; before: string; after: string }
  | { kind: 'match'; words: PracticeWord[]; meanings: Array<{ id: string; text: string }> };

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

export function buildQuiz(set: PracticeSet, max = 10): Question[] {
  const words = shuffle(set.words);
  const known = [...set.words.map((w) => w.hanzi), ...set.pool.map((p) => p.hanzi)];
  const meanings = [...new Set([...set.words, ...set.pool].map((w) => w.meaningVi))];
  const questions: Question[] = [];

  if (set.words.length >= 4) {
    const four = words.slice(0, 4);
    questions.push({ kind: 'match', words: four, meanings: shuffle(four.map((w) => ({ id: w.id, text: w.meaningVi }))) });
  }

  const kinds: Array<'choice' | 'order' | 'fill'> = ['choice', 'order', 'fill'];
  words.forEach((word, i) => {
    if (questions.length >= max) return;
    // Rotate the types, falling back to "choice" when a word has no usable example.
    const preferred = kinds[i % kinds.length];
    const q = makeQuestion(word, preferred, known, meanings) ?? makeQuestion(word, 'choice', known, meanings);
    if (q) questions.push(q);
  });
  return shuffle(questions).slice(0, max);
}

function makeQuestion(
  word: PracticeWord,
  kind: 'choice' | 'order' | 'fill',
  known: string[],
  meanings: string[],
): Question | null {
  if (kind === 'choice') {
    const others = shuffle(meanings.filter((m) => m !== word.meaningVi)).slice(0, 3);
    if (others.length < 3) return null;
    const options = shuffle([word.meaningVi, ...others]);
    return { kind, word, options, answer: options.indexOf(word.meaningVi) };
  }
  const sentence = word.exampleZh?.trim();
  if (!sentence || !sentence.includes(word.hanzi)) return null;
  if (kind === 'fill') {
    const at = sentence.indexOf(word.hanzi);
    return { kind, word, before: sentence.slice(0, at), after: sentence.slice(at + word.hanzi.length) };
  }
  const parts = segment(sentence, known);
  if (parts.length < 3 || parts.length > 8) return null;
  const pieces = parts.map((text, id) => ({ id, text }));
  let shuffled = shuffle(pieces);
  // Never hand out the pieces already in order.
  for (let t = 0; t < 5 && shuffled.every((p, i) => p.id === i); t++) shuffled = shuffle(pieces);
  return { kind, word, pieces: shuffled, answer: pieces.map((p) => p.id) };
}

/** A fill-in answer is right as Hanzi or as pinyin (tones and spaces optional). */
export function fillIsRight(word: PracticeWord, typed: string): boolean {
  const t = typed.trim();
  if (!t) return false;
  return t === word.hanzi || looseAnswer(t) === looseAnswer(word.pinyin);
}

/** Order answers compare by text, so repeated pieces (我…我) may swap places. */
export function orderIsRight(q: Extract<Question, { kind: 'order' }>, picked: number[]): boolean {
  const text = (ids: number[]) => ids.map((id) => q.pieces.find((p) => p.id === id)?.text ?? '').join('');
  return picked.length === q.answer.length && text(picked) === text(q.answer);
}
