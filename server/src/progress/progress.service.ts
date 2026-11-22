import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId } from '../common/types/domain.types';
import { CoursesService } from '../courses/courses.service';
import { DatabaseService } from '../database/database.service';
import { UpdateLessonProgressDto } from './dto/progress.dto';

/** An uploaded video counts as watched once the learner reaches this share of it. */
export const AUTO_COMPLETE_RATIO = 0.9;

@Injectable()
export class ProgressService {
  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
  ) {}

  /**
   * Saves a position and/or a manual tick. The 90% rule can only mark a lesson
   * complete, never undo it; only an explicit `completed: false` does that.
   */
  async updateLesson(user: AuthUser, lessonId: string, dto: UpdateLessonProgressDto) {
    const lesson = await this.db.queryOne('SELECT id, course_id, is_free FROM lessons WHERE id = $1', [lessonId]);
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học.');
    if (!lesson.is_free && !(await this.courses.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException('Bạn chưa có quyền xem bài học này.');
    }

    const reachedEnd =
      dto.positionSeconds !== undefined &&
      dto.durationSeconds !== undefined &&
      dto.positionSeconds >= dto.durationSeconds * AUTO_COMPLETE_RATIO;
    const complete = dto.completed === true || reachedEnd;
    const uncomplete = dto.completed === false;

    const row = await this.db.queryOne(
      `INSERT INTO lesson_progress (id, user_id, lesson_id, course_id, position_seconds, duration_seconds, completed_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, CASE WHEN $7 THEN now() END)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         position_seconds = COALESCE($5, lesson_progress.position_seconds),
         duration_seconds = COALESCE($6, lesson_progress.duration_seconds),
         completed_at = CASE
           WHEN $8 THEN NULL
           WHEN $7 THEN COALESCE(lesson_progress.completed_at, now())
           ELSE lesson_progress.completed_at
         END,
         updated_at = now()
       RETURNING *`,
      [
        generateId('prog'),
        user.id,
        lesson.id,
        lesson.course_id,
        dto.positionSeconds ?? null,
        dto.durationSeconds ?? null,
        complete,
        uncomplete,
      ],
    );
    return this.toLessonProgress(row);
  }

  /** Progress in one course: one entry per lesson the learner has touched. */
  async forCourse(user: AuthUser, courseId: string) {
    const course = await this.db.queryOne('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (!course) throw new NotFoundException('Không tìm thấy khóa học.');
    const [rows, total] = await Promise.all([
      this.db.queryAll(
        `SELECT p.* FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
         WHERE p.user_id = $1 AND p.course_id = $2 ORDER BY p.updated_at DESC`,
        [user.id, courseId],
      ),
      this.db.queryOne<{ n: number }>('SELECT count(*)::int AS n FROM lessons WHERE course_id = $1', [courseId]),
    ]);
    return {
      courseId,
      totalLessons: total?.n ?? 0,
      completedCount: rows.filter((r) => r.completed_at).length,
      lastLessonId: rows[0]?.lesson_id ?? null,
      lessons: rows.map((r) => this.toLessonProgress(r)),
    };
  }

  /** One line per course the learner has started, most recent first ("Học tiếp"). */
  async mine(user: AuthUser) {
    const rows = await this.db.queryAll(
      `WITH per_course AS (
         SELECT course_id,
                count(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed_count,
                max(updated_at) AS last_at
         FROM lesson_progress WHERE user_id = $1 GROUP BY course_id
       ),
       last_row AS (
         SELECT DISTINCT ON (course_id) course_id, lesson_id, position_seconds, duration_seconds, completed_at
         FROM lesson_progress WHERE user_id = $1
         ORDER BY course_id, updated_at DESC
       )
       SELECT pc.course_id, pc.completed_count, pc.last_at,
              (SELECT count(*)::int FROM lessons WHERE course_id = pc.course_id) AS total_lessons,
              lr.lesson_id, lr.position_seconds, lr.duration_seconds, lr.completed_at,
              l.title AS lesson_title, l.sort_order AS lesson_sort, c.title AS course_title, c.module, c.is_free
       FROM per_course pc
       JOIN last_row lr ON lr.course_id = pc.course_id
       JOIN lessons l ON l.id = lr.lesson_id
       JOIN courses c ON c.id = pc.course_id
       ORDER BY pc.last_at DESC`,
      [user.id],
    );
    return rows.map((r) => ({
      courseId: r.course_id,
      courseTitle: r.course_title,
      module: r.module,
      isFree: r.is_free,
      totalLessons: r.total_lessons,
      completedCount: r.completed_count,
      lastActivityAt: r.last_at,
      lastLesson: {
        lessonId: r.lesson_id,
        title: r.lesson_title,
        positionSeconds: r.position_seconds,
        durationSeconds: r.duration_seconds,
        completed: Boolean(r.completed_at),
      },
    }));
  }

  private toLessonProgress(r: any) {
    return {
      lessonId: r.lesson_id,
      courseId: r.course_id,
      completed: Boolean(r.completed_at),
      completedAt: r.completed_at,
      positionSeconds: r.position_seconds,
      durationSeconds: r.duration_seconds,
      updatedAt: r.updated_at,
    };
  }
}
