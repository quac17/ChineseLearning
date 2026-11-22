import { parsePeriod, periodSql } from './stats-period';

describe('parsePeriod', () => {
  it.each(['30d', 'month', 'year'])('keeps %s', (p) => {
    expect(parsePeriod(p)).toBe(p);
  });

  it.each([undefined, '', 'all', "30d'; DROP TABLE users;--", 7])('falls back to 30d for %p', (p) => {
    expect(parsePeriod(p)).toBe('30d');
  });
});

describe('periodSql', () => {
  it('buckets the year by month and shorter periods by day', () => {
    expect(periodSql('year').bucket).toBe('month');
    expect(periodSql('month').bucket).toBe('day');
    expect(periodSql('30d').bucket).toBe('day');
  });

  it('counts whole days in Vietnam time', () => {
    expect(periodSql('30d').since).toContain(`'Asia/Ho_Chi_Minh'`);
    expect(periodSql('30d').since).toContain(`interval '29 days'`);
  });
});
