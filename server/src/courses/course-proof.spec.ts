import { checkRating } from './course-proof';

const SOURCE = 'khảo sát 120 học viên lớp offline 2025';

describe('checkRating (a rating only with a real source)', () => {
  it('saves a value with its source, tidying spaces', () => {
    expect(checkRating({ ratingValue: 4.5, ratingSource: `  khảo sát   120 học viên lớp offline 2025 ` })).toEqual({
      ok: true,
      ratingValue: 4.5,
      ratingSource: SOURCE,
    });
  });

  it.each([
    [null, null],
    [undefined, '   '],
  ])('clears the rating when both are empty (%p, %p)', (value, source) => {
    expect(checkRating({ ratingValue: value, ratingSource: source })).toEqual({ ok: true, ratingValue: null, ratingSource: null });
  });

  it('refuses a value without a source', () => {
    const r = checkRating({ ratingValue: 4.8, ratingSource: '' });
    expect(r.ok).toBe(false);
    expect('message' in r && r.message).toContain('phải kèm nguồn thật');
  });

  it('refuses a source without a value', () => {
    expect(checkRating({ ratingValue: null, ratingSource: SOURCE }).ok).toBe(false);
  });

  it.each([0.5, 5.1, 4.55, Number.NaN])('refuses the value %p', (value) => {
    expect(checkRating({ ratingValue: value, ratingSource: SOURCE }).ok).toBe(false);
  });

  it('refuses a source too short to say who rated, how many and when', () => {
    expect(checkRating({ ratingValue: 4, ratingSource: 'tốt lắm' }).ok).toBe(false);
    expect(checkRating({ ratingValue: 4, ratingSource: 'x'.repeat(201) }).ok).toBe(false);
  });

  it('accepts whole numbers and both ends of the scale', () => {
    expect(checkRating({ ratingValue: 1, ratingSource: SOURCE }).ok).toBe(true);
    expect(checkRating({ ratingValue: 5, ratingSource: SOURCE }).ok).toBe(true);
  });
});
