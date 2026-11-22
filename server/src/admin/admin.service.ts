import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { periodSql, STATS_TZ, StatsPeriod } from './stats-period';

/**
 * Admin stats. Every figure is counted from the database; nothing is
 * estimated. Period-bound figures (revenue, orders, new accounts) start at
 * periodSql(period).since; the rest are totals as of now.
 * Only hard-coded SQL fragments from periodSql are concatenated.
 */
@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async stats(period: StatsPeriod) {
    const { since, bucket } = periodSql(period);
    // A pending order past its expiry counts as expired before the payments
    // job flips its status.
    const expired = `(o.status = 'EXPIRED' OR (o.status = 'PENDING' AND o.expires_at < now()))`;

    const [totals, orders, series, topCourses, unpriced] = await Promise.all([
      this.db.queryOne(
        `SELECT
          (SELECT COUNT(*)::int FROM users WHERE role = 'ADMIN') AS admins,
          (SELECT COUNT(*)::int FROM users WHERE role = 'TEACHER') AS teachers,
          (SELECT COUNT(*)::int FROM users WHERE role = 'STUDENT') AS students,
          (SELECT COUNT(*)::int FROM users WHERE is_active = FALSE) AS locked_users,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= ${since}) AS new_users,
          (SELECT COUNT(*)::int FROM courses) AS courses,
          (SELECT COUNT(*)::int FROM courses WHERE is_published = TRUE) AS published_courses,
          (SELECT COUNT(*)::int FROM lessons) AS lessons,
          (SELECT COUNT(*)::int FROM course_documents) AS documents,
          (SELECT COUNT(*)::int FROM course_enrollments WHERE can_view = TRUE) AS open_enrollments,
          (SELECT COUNT(*)::int FROM course_enrollments e
            WHERE e.can_view = TRUE AND EXISTS (
              SELECT 1 FROM orders o
              WHERE o.user_id = e.student_id AND o.course_id = e.course_id AND o.status = 'PAID'
            )) AS purchased_enrollments`,
      ),
      this.db.queryOne(
        `SELECT
          COUNT(*) FILTER (WHERE o.status = 'PAID' AND o.paid_at >= ${since})::int AS paid,
          COALESCE(SUM(o.amount_vnd) FILTER (WHERE o.status = 'PAID' AND o.paid_at >= ${since}), 0)::bigint AS revenue,
          COUNT(*) FILTER (WHERE ${expired} AND o.created_at >= ${since})::int AS expired,
          COUNT(*) FILTER (WHERE o.status = 'REFUNDED' AND o.refunded_at >= ${since})::int AS refunded,
          COUNT(*) FILTER (WHERE o.needs_review = TRUE AND o.status <> 'REFUNDED')::int AS needs_review
         FROM orders o`,
      ),
      this.db.queryAll(
        `WITH buckets AS (
           SELECT generate_series(
             date_trunc('${bucket}', ${since} AT TIME ZONE ${STATS_TZ}),
             date_trunc('${bucket}', now() AT TIME ZONE ${STATS_TZ}),
             interval '1 ${bucket}'
           ) AS start
         )
         SELECT to_char(b.start, 'YYYY-MM-DD') AS start,
                COUNT(o.id)::int AS orders,
                COALESCE(SUM(o.amount_vnd), 0)::bigint AS revenue
         FROM buckets b
         LEFT JOIN orders o
           ON o.status = 'PAID'
          AND date_trunc('${bucket}', o.paid_at AT TIME ZONE ${STATS_TZ}) = b.start
         GROUP BY b.start
         ORDER BY b.start`,
      ),
      this.db.queryAll(
        `SELECT o.course_id, MAX(o.course_title) AS course_title,
                COUNT(*)::int AS orders, SUM(o.amount_vnd)::bigint AS revenue
         FROM orders o
         WHERE o.status = 'PAID' AND o.paid_at >= ${since}
         GROUP BY o.course_id
         ORDER BY revenue DESC, orders DESC
         LIMIT 5`,
      ),
      this.db.queryAll(
        `SELECT id, title FROM courses
         WHERE is_free = FALSE AND price_vnd IS NULL AND is_published = TRUE
         ORDER BY sort_order ASC, created_at ASC`,
      ),
    ]);

    return {
      period,
      users: {
        total: totals.admins + totals.teachers + totals.students,
        admins: totals.admins,
        teachers: totals.teachers,
        students: totals.students,
        locked: totals.locked_users,
        newInPeriod: totals.new_users,
      },
      courses: {
        total: totals.courses,
        published: totals.published_courses,
        lessons: totals.lessons,
        documents: totals.documents,
        /** Published paid courses without a price: no buy button yet. */
        unpriced: unpriced.map((c) => ({ id: c.id, title: c.title })),
      },
      enrollments: {
        open: totals.open_enrollments,
        /** Open access backed by a paid order; the rest was granted by hand. */
        purchased: totals.purchased_enrollments,
        manual: totals.open_enrollments - totals.purchased_enrollments,
      },
      orders: {
        paid: orders.paid,
        revenueVnd: Number(orders.revenue),
        expired: orders.expired,
        refunded: orders.refunded,
        needsReview: orders.needs_review,
      },
      revenueSeries: {
        bucket,
        points: series.map((p) => ({ start: p.start, orders: p.orders, revenueVnd: Number(p.revenue) })),
      },
      topCourses: topCourses.map((c) => ({
        courseId: c.course_id,
        title: c.course_title,
        orders: c.orders,
        revenueVnd: Number(c.revenue),
      })),
    };
  }
}
