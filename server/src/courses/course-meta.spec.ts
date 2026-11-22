import { detectImageType, normalizeOutcomes, parseDurationMinutes, sumDurationMinutes } from './course-meta';

describe('parseDurationMinutes (free-text lesson duration → minutes)', () => {
  it.each([
    ['12 phút', 12],
    ['  15 Phút ', 15],
    ['8p', 8],
    ['90', 90],
    ['1 giờ 30 phút', 90],
    ['2 giờ', 120],
    ['1h30', 90],
    ['1h', 60],
    ['45 min', 45],
    ['14:00', 14],
    ['12:30', 13],
    ['0:40', 1],
    ['1:02:00', 62],
  ])('%s → %d', (text, minutes) => {
    expect(parseDurationMinutes(text)).toBe(minutes);
  });

  it.each([[''], ['   '], ['khoảng mười phút'], ['0 phút'], ['12:75'], [null], [undefined], ['99999']])(
    'returns null for %p',
    (text) => {
      expect(parseDurationMinutes(text as string | null | undefined)).toBeNull();
    },
  );
});

describe('sumDurationMinutes', () => {
  it('adds known minutes and counts lessons that have none', () => {
    expect(sumDurationMinutes([{ duration_minutes: 12 }, { duration_minutes: null }, { duration_minutes: 3 }])).toEqual({
      totalMinutes: 15,
      missing: 1,
    });
    expect(sumDurationMinutes([])).toEqual({ totalMinutes: 0, missing: 0 });
  });
});

describe('normalizeOutcomes', () => {
  it('trims, drops blanks and exact duplicates, keeps order', () => {
    expect(normalizeOutcomes(['  Đọc pinyin ', '', '   ', 'Chào hỏi', 'Đọc pinyin'])).toEqual(['Đọc pinyin', 'Chào hỏi']);
  });
});

describe('detectImageType (magic bytes, not the client MIME)', () => {
  const bytes = (...b: number[]) => Buffer.from([...b, ...new Array(16).fill(0)]);
  it('recognises JPEG, PNG and WebP', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 ')]))).toBe('webp');
  });
  it('rejects SVG, GIF, text and empty buffers', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
