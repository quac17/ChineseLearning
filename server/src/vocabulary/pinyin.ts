/**
 * Turns numbered pinyin ("ni3 hao3", "jiao4", "lv4") into tone marks
 * ("nǐ hǎo", "jiào", "lǜ"). Text that already has marks is left alone, so
 * teachers can type either form.
 *
 * Mark placement (standard rule): on "a" or "e" if present; on the "o" of
 * "ou"; otherwise on the last vowel. Tone 5 or 0 = neutral (no mark).
 */
const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

function markSyllable(syllable: string, tone: number): string {
  if (tone < 1 || tone > 4) return syllable;
  const lower = syllable.toLowerCase();
  let index = -1;
  if (lower.includes('a')) index = lower.indexOf('a');
  else if (lower.includes('e')) index = lower.indexOf('e');
  else if (lower.includes('ou')) index = lower.indexOf('o');
  else {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) {
        index = i;
        break;
      }
    }
  }
  if (index < 0) return syllable;
  const vowel = lower[index];
  let marked = MARKS[vowel][tone - 1];
  if (syllable[index] !== vowel) marked = marked.toUpperCase();
  return syllable.slice(0, index) + marked + syllable.slice(index + 1);
}

export function normalizePinyin(input: string): string {
  return (
    input
      .trim()
      .replace(/\s+/g, ' ')
      // "v" and "u:" are the usual keyboard spellings of ü ("v" is never an initial).
      .replace(/u:/g, 'ü')
      .replace(/U:/g, 'Ü')
      .replace(/v/g, 'ü')
      .replace(/V/g, 'Ü')
      .replace(/([a-zA-ZüÜ]+)([0-5])/g, (_, syl: string, tone: string) => markSyllable(syl, Number(tone)))
  );
}
