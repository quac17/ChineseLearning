/** One word as typed in the editor (pinyin may still have tone numbers). */
export interface WordDraft {
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  exampleZh: string;
  exampleVi: string;
}

/**
 * Rows copied from Excel / Google Sheets: one word per line, cells separated
 * by tabs, columns Hanzi, pinyin, meaning, example, example meaning. A header
 * row ("Chữ Hán", "Hanzi"…) and blank lines are ignored; lines missing one of
 * the first three cells are reported by line number. Only tabs split cells:
 * Vietnamese meanings often contain commas.
 */
export function parseSheet(text: string): { words: WordDraft[]; skipped: number[] } {
  const words: WordDraft[] = [];
  const skipped: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const [hanzi = '', pinyin = '', meaningVi = '', exampleZh = '', exampleVi = ''] = line.split('\t').map((c) => c.trim());
    if (i === 0 && /^(chữ hán|hán tự|hanzi|汉字)$/i.test(hanzi)) return;
    if (!hanzi || !pinyin || !meaningVi) {
      skipped.push(i + 1);
      return;
    }
    words.push({ hanzi, pinyin, meaningVi, exampleZh, exampleVi });
  });
  return { words, skipped };
}
