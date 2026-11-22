import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId } from '../common/types/domain.types';
import { CoursesService } from '../courses/courses.service';
import { DatabaseService } from '../database/database.service';
import { AnswerDto, AskQuestionDto, CreateNoteDto, UpdateNoteDto } from './dto/notes-qa.dto';
import { canAnswer, canRemoveAnswer, canRemoveQuestion } from './notes-qa.rules';

interface LessonRow {
  id: string;
  course_id: string;
  is_free: boolean;
  teacher_id: string | null;
}

/**
 * Notes are private: every query is scoped to the caller, and someone else's
 * note answers 404 rather than 403 so ids reveal nothing.
 * Q&A is shared by everyone with access to the course.
 */
@Injectable()
export class NotesQaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
  ) {}

  // Notes ------------------------------------------------------------------

  async listNotes(user: AuthUser, lessonId: string) {
    await this.lessonToWatch(user, lessonId);
    const rows = await this.db.queryAll(
      `SELECT * FROM lesson_notes WHERE user_id = $1 AND lesson_id = $2
       ORDER BY video_seconds ASC NULLS LAST, created_at ASC`,
      [user.id, lessonId],
    );
    return rows.map(toNote);
  }

  async createNote(user: AuthUser, dto: CreateNoteDto) {
    const lesson = await this.lessonToWatch(user, dto.lessonId);
    const row = await this.db.queryOne(
      `INSERT INTO lesson_notes (id, user_id, lesson_id, course_id, body, video_seconds)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [generateId('note'), user.id, lesson.id, lesson.course_id, dto.body, dto.videoSeconds ?? null],
    );
    return toNote(row);
  }

  async updateNote(user: AuthUser, id: string, dto: UpdateNoteDto) {
    const row = await this.db.queryOne(
      `UPDATE lesson_notes SET body = $3, updated_at = now()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, user.id, dto.body],
    );
    if (!row) throw new NotFoundException('Không tìm thấy ghi chú.');
    return toNote(row);
  }

  async removeNote(user: AuthUser, id: string) {
    const row = await this.db.queryOne('DELETE FROM lesson_notes WHERE id = $1 AND user_id = $2 RETURNING id', [
      id,
      user.id,
    ]);
    if (!row) throw new NotFoundException('Không tìm thấy ghi chú.');
    return { id: row.id, deleted: true };
  }

  // Q&A --------------------------------------------------------------------

  async listQuestions(user: AuthUser, lessonId: string) {
    const lesson = await this.lessonOfCourse(user, lessonId);
    const questions = await this.db.queryAll(
      `SELECT q.*, u.full_name, u.role
       FROM lesson_questions q JOIN users u ON u.id = q.user_id
       WHERE q.lesson_id = $1 ORDER BY q.created_at DESC`,
      [lessonId],
    );
    const answers = questions.length
      ? await this.db.queryAll(
          `SELECT a.*, u.full_name, u.role
           FROM lesson_answers a JOIN users u ON u.id = a.user_id
           WHERE a.question_id = ANY($1::varchar[]) ORDER BY a.created_at ASC`,
          [questions.map((q) => q.id)],
        )
      : [];
    return {
      canAnswer: canAnswer(user, lesson.teacher_id),
      questions: questions.map((q) => ({
        id: q.id,
        lessonId: q.lesson_id,
        body: q.body,
        createdAt: q.created_at,
        author: toAuthor(q),
        mine: q.user_id === user.id,
        canDelete: canRemoveQuestion(user, q, lesson.teacher_id),
        answers: answers
          .filter((a) => a.question_id === q.id)
          .map((a) => ({
            id: a.id,
            body: a.body,
            createdAt: a.created_at,
            author: toAuthor(a),
            canDelete: canRemoveAnswer(user, a),
          })),
      })),
    };
  }

  async ask(user: AuthUser, dto: AskQuestionDto) {
    const lesson = await this.lessonOfCourse(user, dto.lessonId);
    const row = await this.db.queryOne(
      `INSERT INTO lesson_questions (id, user_id, lesson_id, course_id, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [generateId('ques'), user.id, lesson.id, lesson.course_id, dto.body],
    );
    return { id: row.id };
  }

  async removeQuestion(user: AuthUser, id: string) {
    const q = await this.db.queryOne(
      `SELECT q.id, q.user_id, c.teacher_id FROM lesson_questions q JOIN courses c ON c.id = q.course_id
       WHERE q.id = $1`,
      [id],
    );
    if (!q) throw new NotFoundException('Không tìm thấy câu hỏi.');
    if (!canRemoveQuestion(user, q, q.teacher_id)) {
      throw new ForbiddenException('Bạn không thể xoá câu hỏi này.');
    }
    await this.db.query('DELETE FROM lesson_questions WHERE id = $1', [id]);
    return { id, deleted: true };
  }

  async answer(user: AuthUser, questionId: string, dto: AnswerDto) {
    const q = await this.db.queryOne(
      `SELECT q.id, c.teacher_id FROM lesson_questions q JOIN courses c ON c.id = q.course_id WHERE q.id = $1`,
      [questionId],
    );
    if (!q) throw new NotFoundException('Không tìm thấy câu hỏi.');
    if (!canAnswer(user, q.teacher_id)) {
      throw new ForbiddenException('Chỉ giáo viên phụ trách khoá học hoặc quản trị viên được trả lời.');
    }
    const row = await this.db.queryOne(
      `INSERT INTO lesson_answers (id, question_id, user_id, body) VALUES ($1, $2, $3, $4) RETURNING id`,
      [generateId('answ'), q.id, user.id, dto.body],
    );
    return { id: row.id };
  }

  async removeAnswer(user: AuthUser, id: string) {
    const a = await this.db.queryOne('SELECT id, user_id FROM lesson_answers WHERE id = $1', [id]);
    if (!a) throw new NotFoundException('Không tìm thấy câu trả lời.');
    if (!canRemoveAnswer(user, a)) throw new ForbiddenException('Bạn không thể xoá câu trả lời này.');
    await this.db.query('DELETE FROM lesson_answers WHERE id = $1', [id]);
    return { id, deleted: true };
  }

  // Access -----------------------------------------------------------------

  private async findLesson(lessonId: string): Promise<LessonRow> {
    const lesson = await this.db.queryOne<LessonRow>(
      `SELECT l.id, l.course_id, l.is_free, c.teacher_id
       FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = $1`,
      [lessonId],
    );
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học.');
    return lesson;
  }

  /** Notes: anyone who may watch the lesson (free preview included). */
  private async lessonToWatch(user: AuthUser, lessonId: string) {
    const lesson = await this.findLesson(lessonId);
    if (!lesson.is_free && !(await this.courses.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException('Bạn chưa có quyền xem bài học này.');
    }
    return lesson;
  }

  /** Q&A: only people with access to the whole course (learners, its teacher, admins). */
  private async lessonOfCourse(user: AuthUser, lessonId: string) {
    const lesson = await this.findLesson(lessonId);
    if (!(await this.courses.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException('Hỏi đáp chỉ dành cho học viên đã có quyền xem khoá học.');
    }
    return lesson;
  }
}

function toNote(r: any) {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    courseId: r.course_id,
    body: r.body,
    videoSeconds: r.video_seconds,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toAuthor(r: any) {
  return { fullName: r.full_name, role: r.role };
}
