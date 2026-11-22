import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/types/domain.types';
import { REVIEWS_MIN_TO_SHOW, canReply, normalizeText, publicName, reviewEligibility, reviewSummary } from './reviews.rules';

const user = (id: string, role: Role): AuthUser => ({ id, role, email: `${id}@e.test`, fullName: id, phone: null, bio: null });
const student = user('s1', Role.STUDENT);
const paid = { is_free: false };

describe('reviewEligibility', () => {
  it('a student with open access to a paid course may review', () => {
    expect(reviewEligibility({ user: student, course: paid, canView: true })).toEqual({ ok: true });
  });

  it('a student without access (never bought, or revoked) may not', () => {
    const r = reviewEligibility({ user: student, course: paid, canView: false });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain('đã mua');
  });

  it('free courses take no reviews, even from enrolled students', () => {
    const r = reviewEligibility({ user: student, course: { is_free: true }, canView: true });
    expect(r.ok === false && r.reason).toContain('miễn phí');
  });

  it('teachers and admins never review, even with access', () => {
    expect(reviewEligibility({ user: user('t1', Role.TEACHER), course: paid, canView: true }).ok).toBe(false);
    expect(reviewEligibility({ user: user('a1', Role.ADMIN), course: paid, canView: true }).ok).toBe(false);
  });

  it('logged out and missing course are refused with a reason', () => {
    expect(reviewEligibility({ user: null, course: paid, canView: false })).toEqual({
      ok: false,
      reason: 'Đăng nhập để đánh giá khoá học.',
    });
    expect(reviewEligibility({ user: student, course: null, canView: true }).ok).toBe(false);
  });
});

describe('reviewSummary', () => {
  it('hides the average below the threshold but keeps the count', () => {
    expect(REVIEWS_MIN_TO_SHOW).toBe(3);
    expect(reviewSummary(0, null)).toEqual({ average: null, count: 0 });
    expect(reviewSummary(2, '4.5')).toEqual({ average: null, count: 2 });
  });

  it('rounds the average of visible reviews to one decimal from the threshold on', () => {
    expect(reviewSummary(3, '4.6666666')).toEqual({ average: 4.7, count: 3 });
    expect(reviewSummary(4, 3.25)).toEqual({ average: 3.3, count: 4 });
    expect(reviewSummary(5, '5.0000')).toEqual({ average: 5, count: 5 });
  });

  it('pg count strings are numbers too', () => {
    expect(reviewSummary('3' as unknown as number, '4')).toEqual({ average: 4, count: 3 });
  });
});

describe('canReply', () => {
  it('the course teacher and admins reply', () => {
    expect(canReply(user('t1', Role.TEACHER), 't1')).toBe(true);
    expect(canReply(user('a1', Role.ADMIN), 't1')).toBe(true);
  });
  it('other teachers and students do not', () => {
    expect(canReply(user('t2', Role.TEACHER), 't1')).toBe(false);
    expect(canReply(user('t1', Role.STUDENT), 't1')).toBe(false);
    expect(canReply(user('t1', Role.TEACHER), null)).toBe(false);
  });
});

describe('publicName', () => {
  it('keeps the given name and shortens the rest', () => {
    expect(publicName('Nguyễn Văn An')).toBe('N. V. An');
    expect(publicName('trần thị bích')).toBe('T. T. bích');
    expect(publicName('Lan')).toBe('Lan');
  });
  it('drops notes in brackets and copes with empty names', () => {
    expect(publicName('Nguyễn Văn A (Học sinh)')).toBe('N. V. A');
    expect(publicName('  ')).toBe('Học viên');
    expect(publicName(null)).toBe('Học viên');
  });
});

describe('normalizeText', () => {
  it('trims, unifies line breaks and turns blank into null', () => {
    expect(normalizeText('  hay\r\nlắm ')).toBe('hay\nlắm');
    expect(normalizeText('   ')).toBeNull();
    expect(normalizeText(5)).toBe(5);
  });
});
