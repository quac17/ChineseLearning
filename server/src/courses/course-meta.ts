/** Course metadata rules (#28): lesson minutes, outcomes, cover images. */

export enum CourseLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

/** Longest lesson we accept, in minutes (10 hours). */
export const MAX_LESSON_MINUTES = 600;

/**
 * Reads a teacher's free-text duration as whole minutes: "12 phút", "1 giờ 30
 * phút", "1h30", "45 min", "90", "14:00" (mm:ss), "1:02:00" (h:mm:ss).
 * Seconds round up. Returns null when the text is not a duration.
 */
export function parseDurationMinutes(text: string | null | undefined): number | null {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return null;
  let minutes: number | null = null;

  const clock = t.match(/^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/);
  if (clock) {
    const [, h, m, sec] = clock;
    if (Number(sec) >= 60 || (h !== undefined && Number(m) >= 60)) return null;
    minutes = Number(h ?? 0) * 60 + Number(m) + (Number(sec) > 0 ? 1 : 0);
  } else {
    const words = t.match(/^(?:(\d+)\s*(?:giờ|gio|h|tiếng)\s*)?(?:(\d+)\s*(?:phút|phut|p|min|m|')?)?$/);
    if (words && (words[1] !== undefined || words[2] !== undefined)) {
      minutes = Number(words[1] ?? 0) * 60 + Number(words[2] ?? 0);
    }
  }
  if (minutes === null || minutes <= 0 || minutes > MAX_LESSON_MINUTES) return null;
  return minutes;
}

/** Total of the lessons that have minutes, and how many have none. */
export function sumDurationMinutes(lessons: Array<{ duration_minutes?: number | null }>) {
  let totalMinutes = 0;
  let missing = 0;
  for (const l of lessons) {
    if (typeof l.duration_minutes === 'number' && l.duration_minutes > 0) totalMinutes += l.duration_minutes;
    else missing++;
  }
  return { totalMinutes, missing };
}

/** "Bạn sẽ học được": trimmed, without blank lines or exact duplicates. */
export function normalizeOutcomes(items: string[]): string[] {
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

export type CoverImageType = 'jpg' | 'png' | 'webp';

export const COVER_CONTENT_TYPES: Record<CoverImageType, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Type from the file's first bytes, so a renamed SVG or HTML file is never stored as a cover. */
export function detectImageType(buf: Buffer): CoverImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
