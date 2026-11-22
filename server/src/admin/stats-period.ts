/**
 * Reporting periods of the admin stats page. Each maps to hard-coded SQL
 * (never user text): where the period starts and how revenue is bucketed.
 * Days and months follow Vietnam time.
 */
export const STATS_PERIODS = ['30d', 'month', 'year'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export const STATS_TZ = `'Asia/Ho_Chi_Minh'`;

export interface PeriodSql {
  /** timestamptz expression for the first instant of the period. */
  since: string;
  /** date_trunc unit of one chart bar. */
  bucket: 'day' | 'month';
}

export function periodSql(period: StatsPeriod): PeriodSql {
  switch (period) {
    case 'month':
      return { since: `(date_trunc('month', now() AT TIME ZONE ${STATS_TZ}) AT TIME ZONE ${STATS_TZ})`, bucket: 'day' };
    case 'year':
      return { since: `(date_trunc('year', now() AT TIME ZONE ${STATS_TZ}) AT TIME ZONE ${STATS_TZ})`, bucket: 'month' };
    case '30d':
    default:
      // Today plus the 29 whole days before it.
      return {
        since: `((date_trunc('day', now() AT TIME ZONE ${STATS_TZ}) - interval '29 days') AT TIME ZONE ${STATS_TZ})`,
        bucket: 'day',
      };
  }
}

/** Accepts only known periods; anything else falls back to the last 30 days. */
export function parsePeriod(value: unknown): StatsPeriod {
  return STATS_PERIODS.includes(value as StatsPeriod) ? (value as StatsPeriod) : '30d';
}
