import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId } from '../common/types/domain.types';
import { CoursesService } from '../courses/courses.service';
import { DatabaseService } from '../database/database.service';
import { HideReviewDto, ReplyDto, SaveReviewDto } from './dto/reviews.dto';
import { REVIEWS_PAGE_SIZE, canReply, publicName, reviewEligibility, reviewSummary } from './reviews.rules';

type Status = 'all' | 'visible' | 'hidden';

/**
 * Real reviews of paid courses (#41). Learners with open access write one
 * review each; the course's teacher (or an admin) replies; admins hide or
 * unhide with a reason. Hidden reviews never reach the public list or the
 * average, but the author still sees theirs and why it is hidden.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
  ) {}

  // Public ------------------------------------------------------------------

  async listPublic(courseId: string, page = 1) {
    await this.findCourse(courseId);
    const offset = (page - 1) * REVIEWS_PAGE_SIZE;
    const [rows, summary] = await Promise.all([
      this.db.queryAll(
        `SELECT r.*, u.full_name FROM course_reviews r JOIN users u ON u.id = r.student_id
         WHERE r.course_id = $1 AND r.is_hidden = FALSE
         ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`,
        [courseId, REVIEWS_PAGE_SIZE, offset],
      ),
      this.summary(courseId),
    ]);
    return {
      items: rows.map(toPublic),
      page,
      pageSize: REVIEWS_PAGE_SIZE,
      total: summary.count,
      summary,
    };
  }

  async summary(courseId: string) {
    const row = await this.db.queryOne(
      `SELECT count(*)::int AS count, avg(stars) AS average FROM course_reviews
       WHERE course_id = $1 AND is_hidden = FALSE`,
      [courseId],
    );
    return reviewSummary(row?.count ?? 0, row?.average ?? null);
  }

  // The learner's own review -------------------------------------------------

  async mine(user: AuthUser, courseId: string) {
    const course = await this.findCourse(courseId);
    const eligibility = reviewEligibility({ user, course, canView: await this.hasOpenEnrollment(courseId, user.id) });
    const row = await this.db.queryOne(
      `SELECT r.*, u.full_name FROM course_reviews r JOIN users u ON u.id = r.student_id
       WHERE r.course_id = $1 AND r.student_id = $2`,
      [courseId, user.id],
    );
    return {
      canReview: eligibility.ok,
      reason: 'reason' in eligibility ? eligibility.reason : null,
      review: row ? toOwn(row) : null,
    };
  }

  /** Create or edit (one review per learner and course). Needs access right now. */
  async saveMine(user: AuthUser, courseId: string, dto: SaveReviewDto) {
    const course = await this.findCourse(courseId);
    const eligibility = reviewEligibility({ user, course, canView: await this.hasOpenEnrollment(courseId, user.id) });
    if ('reason' in eligibility) throw new ForbiddenException(eligibility.reason);
    await this.db.query(
      `INSERT INTO course_reviews (id, course_id, student_id, stars, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (course_id, student_id)
       DO UPDATE SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, updated_at = now()`,
      [generateId('revw'), courseId, user.id, dto.stars, dto.comment ?? null],
    );
    return this.mine(user, courseId);
  }

  /** The author may always withdraw their review, access or not. */
  async removeMine(user: AuthUser, courseId: string) {
    const row = await this.db.queryOne(
      'DELETE FROM course_reviews WHERE course_id = $1 AND student_id = $2 RETURNING id',
      [courseId, user.id],
    );
    if (!row) throw new NotFoundException('Bạn chưa đánh giá khoá học này.');
    return { id: row.id, deleted: true };
  }

  // Teacher / admin ------------------------------------------------------------

  /** Every review of one course, hidden ones included, for its teacher or an admin. */
  async listForCourseManager(user: AuthUser, courseId: string, page = 1) {
    await this.courses.assertCanManageCourse(courseId, user);
    const offset = (page - 1) * REVIEWS_PAGE_SIZE;
    const [rows, totals, summary] = await Promise.all([
      this.db.queryAll(
        `SELECT r.*, u.full_name FROM course_reviews r JOIN users u ON u.id = r.student_id
         WHERE r.course_id = $1 ORDER BY (r.reply IS NULL) DESC, r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`,
        [courseId, REVIEWS_PAGE_SIZE, offset],
      ),
      this.db.queryOne(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE reply IS NULL AND NOT is_hidden)::int AS unanswered
         FROM course_reviews WHERE course_id = $1`,
        [courseId],
      ),
      this.summary(courseId),
    ]);
    return {
      items: rows.map(toManaged),
      page,
      pageSize: REVIEWS_PAGE_SIZE,
      total: totals.total,
      unanswered: totals.unanswered,
      summary,
    };
  }

  async reply(user: AuthUser, reviewId: string, dto: ReplyDto) {
    const review = await this.reviewToManage(user, reviewId);
    const row = await this.db.queryOne(
      `UPDATE course_reviews SET reply = $2, replied_by_id = $3, replied_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [review.id, dto.body, user.id],
    );
    return toManaged({ ...row, full_name: review.full_name });
  }

  async removeReply(user: AuthUser, reviewId: string) {
    const review = await this.reviewToManage(user, reviewId);
    const row = await this.db.queryOne(
      `UPDATE course_reviews SET reply = NULL, replied_by_id = NULL, replied_at = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [review.id],
    );
    return toManaged({ ...row, full_name: review.full_name });
  }

  /** Admin moderation list across courses. */
  async listForAdmin(status: Status = 'all', page = 1) {
    const filter = status === 'hidden' ? 'WHERE r.is_hidden = TRUE' : status === 'visible' ? 'WHERE r.is_hidden = FALSE' : '';
    const offset = (page - 1) * REVIEWS_PAGE_SIZE;
    const [rows, totals] = await Promise.all([
      this.db.queryAll(
        `SELECT r.*, u.full_name, c.title AS course_title FROM course_reviews r
         JOIN users u ON u.id = r.student_id JOIN courses c ON c.id = r.course_id
         ${filter} ORDER BY r.created_at DESC, r.id DESC LIMIT $1 OFFSET $2`,
        [REVIEWS_PAGE_SIZE, offset],
      ),
      this.db.queryOne(
        `SELECT count(*)::int AS total FROM course_reviews r ${filter}`,
      ),
    ]);
    return {
      items: rows.map((r) => ({ ...toManaged(r), course: { id: r.course_id, title: r.course_title } })),
      page,
      pageSize: REVIEWS_PAGE_SIZE,
      total: totals.total,
    };
  }

  async setHidden(user: AuthUser, reviewId: string, dto: HideReviewDto) {
    const exists = await this.db.queryOne('SELECT id FROM course_reviews WHERE id = $1', [reviewId]);
    if (!exists) throw new NotFoundException('Không tìm thấy đánh giá.');
    const row = dto.hidden
      ? await this.db.queryOne(
          `UPDATE course_reviews SET is_hidden = TRUE, hidden_by_id = $2, hidden_reason = $3, hidden_at = now(), updated_at = now()
           WHERE id = $1 RETURNING *`,
          [reviewId, user.id, dto.reason],
        )
      : await this.db.queryOne(
          `UPDATE course_reviews SET is_hidden = FALSE, hidden_by_id = NULL, hidden_reason = NULL, hidden_at = NULL, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [reviewId],
        );
    return { id: row.id, isHidden: row.is_hidden, hiddenReason: row.hidden_reason, summary: await this.summary(row.course_id) };
  }

  // Helpers --------------------------------------------------------------------

  private async findCourse(courseId: string) {
    const course = await this.db.queryOne<{ id: string; is_free: boolean; teacher_id: string | null }>(
      'SELECT id, is_free, teacher_id FROM courses WHERE id = $1',
      [courseId],
    );
    if (!course) throw new NotFoundException('Không tìm thấy khóa học.');
    return course;
  }

  private async hasOpenEnrollment(courseId: string, userId: string) {
    const row = await this.db.queryOne(
      'SELECT can_view FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
      [courseId, userId],
    );
    return Boolean(row?.can_view);
  }

  private async reviewToManage(user: AuthUser, reviewId: string) {
    const review = await this.db.queryOne(
      `SELECT r.id, r.course_id, u.full_name, c.teacher_id FROM course_reviews r
       JOIN users u ON u.id = r.student_id JOIN courses c ON c.id = r.course_id WHERE r.id = $1`,
      [reviewId],
    );
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');
    if (!canReply(user, review.teacher_id)) {
      throw new ForbiddenException('Chỉ giáo viên phụ trách khoá học hoặc quản trị viên được trả lời đánh giá.');
    }
    return review;
  }
}

function toReply(r: any) {
  return r.reply ? { body: r.reply, repliedAt: r.replied_at } : null;
}

/** What anyone may see: no ids of people, the reviewer's name shortened. */
function toPublic(r: any) {
  return {
    id: r.id,
    stars: r.stars,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorName: publicName(r.full_name),
    reply: toReply(r),
  };
}

/** The author's own review, with its moderation state. */
function toOwn(r: any) {
  return { ...toPublic(r), isHidden: r.is_hidden, hiddenReason: r.is_hidden ? r.hidden_reason : null };
}

/** Teacher / admin view: full name and moderation state. */
function toManaged(r: any) {
  return {
    ...toOwn(r),
    courseId: r.course_id,
    studentName: r.full_name,
    hiddenAt: r.hidden_at,
  };
}
