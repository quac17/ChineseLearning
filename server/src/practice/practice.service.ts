import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId, Role } from '../common/types/domain.types';
import { DatabaseService } from '../database/database.service';
import { SaveReviewsDto } from './dto/practice.dto';
import { nextReview } from './leitner';

/**
 * Which lessons the viewer may practise: the same rule as watching the video
 * (free lesson or course, admin, owner teacher, or an open enrollment).
 * $1 = user id or null, $2 = is admin.
 */
const WATCHABLE = `
  (c.is_published OR $2 OR c.teacher_id = $1)
  AND (l.is_free OR c.is_free OR $2 OR c.teacher_id = $1
       OR EXISTS (SELECT 1 FROM course_enrollments e
                  WHERE e.course_id = c.id AND e.student_id = $1 AND e.can_view = TRUE))`;

export interface PracticeWord {
  id: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  exampleZh: string | null;
  exampleVi: string | null;
  /** Leitner box (1–5) and next review, for logged-in learners who have seen the word. */
  box: number | null;
  dueAt: string | null;
}

@Injectable()
export class PracticeService {
  constructor(private readonly db: DatabaseService) {}

  /** Lessons with words the viewer can practise, grouped by course, plus today's due count. */
  async decks(user: AuthUser | null) {
    const rows = await this.db.queryAll(
      `SELECT c.id AS course_id, c.title AS course_title, c.module, c.sort_order AS course_sort,
              l.id AS lesson_id, l.title AS lesson_title, l.sort_order AS lesson_sort,
              count(v.id)::int AS word_count,
              count(r.id) FILTER (WHERE r.due_at <= now())::int AS due_count
       FROM lessons l
       JOIN courses c ON c.id = l.course_id
       JOIN lesson_vocabulary v ON v.lesson_id = l.id
       LEFT JOIN vocab_reviews r ON r.vocabulary_id = v.id AND r.user_id = $1
       WHERE ${WATCHABLE}
       GROUP BY c.id, l.id
       ORDER BY c.sort_order, c.created_at, l.sort_order, l.created_at`,
      [user?.id ?? null, user?.role === Role.ADMIN],
    );
    const courses = new Map<string, any>();
    for (const r of rows) {
      if (!courses.has(r.course_id)) {
        courses.set(r.course_id, { courseId: r.course_id, courseTitle: r.course_title, module: r.module, lessons: [] });
      }
      courses.get(r.course_id).lessons.push({
        lessonId: r.lesson_id,
        title: r.lesson_title,
        wordCount: r.word_count,
        dueCount: r.due_count,
      });
    }
    return {
      dueCount: rows.reduce((n, r) => n + r.due_count, 0),
      courses: [...courses.values()],
    };
  }

  /**
   * Words of one lesson, or all words due today (`due`, logged in only).
   * `pool` holds other words of the same courses, for quiz distractors.
   */
  async words(user: AuthUser | null, opts: { lessonId?: string; due?: boolean }) {
    const params = [user?.id ?? null, user?.role === Role.ADMIN];
    let filter: string;
    let title: string;
    if (opts.due) {
      if (!user) throw new UnauthorizedException('Đăng nhập để ôn các từ đến hạn.');
      filter = 'r.due_at <= now()';
      title = 'Từ cần ôn hôm nay';
    } else if (opts.lessonId) {
      const lesson = await this.db.queryOne(
        `SELECT l.id, l.title, c.title AS course_title FROM lessons l JOIN courses c ON c.id = l.course_id
         WHERE l.id = $3 AND ${WATCHABLE}`,
        [...params, opts.lessonId],
      );
      if (!lesson) {
        const exists = await this.db.queryOne('SELECT 1 FROM lessons WHERE id = $1', [opts.lessonId]);
        if (!exists) throw new NotFoundException('Không tìm thấy bài học.');
        throw new ForbiddenException('Bạn chưa có quyền luyện tập bài học này.');
      }
      params.push(opts.lessonId);
      filter = 'l.id = $3';
      title = `${lesson.course_title} · ${lesson.title}`;
    } else {
      throw new BadRequestException('Chọn một bài học để luyện tập.');
    }

    const rows = await this.db.queryAll(
      `SELECT v.*, l.title AS lesson_title, c.id AS course_id, c.title AS course_title, r.box, r.due_at
       FROM lesson_vocabulary v
       JOIN lessons l ON l.id = v.lesson_id
       JOIN courses c ON c.id = l.course_id
       LEFT JOIN vocab_reviews r ON r.vocabulary_id = v.id AND r.user_id = $1
       WHERE ${WATCHABLE} AND ${filter}
       ORDER BY c.sort_order, l.sort_order, v.sort_order`,
      params,
    );
    const words: PracticeWord[] = rows.map((r) => ({
      id: r.id,
      lessonId: r.lesson_id,
      lessonTitle: r.lesson_title,
      courseId: r.course_id,
      courseTitle: r.course_title,
      hanzi: r.hanzi,
      pinyin: r.pinyin,
      meaningVi: r.meaning_vi,
      exampleZh: r.example_zh,
      exampleVi: r.example_vi,
      box: r.box ?? null,
      dueAt: r.due_at ?? null,
    }));

    const courseIds = [...new Set(words.map((w) => w.courseId))];
    const pool = courseIds.length
      ? await this.db.queryAll(
          `SELECT v.id, v.hanzi, v.pinyin, v.meaning_vi AS "meaningVi"
           FROM lesson_vocabulary v JOIN lessons l ON l.id = v.lesson_id JOIN courses c ON c.id = l.course_id
           WHERE c.id = ANY($3::varchar[]) AND ${WATCHABLE} AND NOT (v.id = ANY($4::varchar[]))
           ORDER BY random() LIMIT 30`,
          [user?.id ?? null, user?.role === Role.ADMIN, courseIds, words.map((w) => w.id)],
        )
      : [];
    return { title, words, pool };
  }

  /** Records flashcard/quiz results and moves each word between Leitner boxes. */
  async saveReviews(user: AuthUser, dto: SaveReviewsDto) {
    const ids = [...new Set(dto.results.map((r) => r.vocabularyId))];
    const allowed = await this.db.queryAll<{ id: string }>(
      `SELECT v.id FROM lesson_vocabulary v JOIN lessons l ON l.id = v.lesson_id JOIN courses c ON c.id = l.course_id
       WHERE v.id = ANY($3::varchar[]) AND ${WATCHABLE}`,
      [user.id, user.role === Role.ADMIN, ids],
    );
    if (allowed.length !== ids.length) {
      throw new ForbiddenException('Có từ thuộc bài học bạn chưa có quyền xem.');
    }

    const now = new Date();
    return this.db.withTransaction(async (tx) => {
      const existing = await tx.query(
        `SELECT * FROM vocab_reviews WHERE user_id = $1 AND vocabulary_id = ANY($2::varchar[]) FOR UPDATE`,
        [user.id, ids],
      );
      const state = new Map(
        existing.rows.map((r) => [
          r.vocabulary_id,
          { box: r.box, dueAt: new Date(r.due_at), correctCount: r.correct_count, wrongCount: r.wrong_count },
        ]),
      );
      // Results apply in order, so one session can mark a word wrong then right.
      for (const r of dto.results) {
        state.set(r.vocabularyId, nextReview(state.get(r.vocabularyId) ?? null, r.outcome, now));
      }
      const saved = [];
      for (const id of ids) {
        const s = state.get(id)!;
        const row = (
          await tx.query(
            `INSERT INTO vocab_reviews (id, user_id, vocabulary_id, box, due_at, last_reviewed_at, correct_count, wrong_count)
             VALUES ($1, $2, $3, $4, $5, now(), $6, $7)
             ON CONFLICT (user_id, vocabulary_id) DO UPDATE SET
               box = EXCLUDED.box, due_at = EXCLUDED.due_at, last_reviewed_at = now(),
               correct_count = EXCLUDED.correct_count, wrong_count = EXCLUDED.wrong_count, updated_at = now()
             RETURNING vocabulary_id, box, due_at`,
            [generateId('rev'), user.id, id, s.box, s.dueAt, s.correctCount, s.wrongCount],
          )
        ).rows[0];
        saved.push({ vocabularyId: row.vocabulary_id, box: row.box, dueAt: row.due_at });
      }
      return { saved };
    });
  }
}
