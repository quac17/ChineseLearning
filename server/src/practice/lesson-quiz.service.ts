import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { StorageService } from '../common/storage/storage.service';
import { generateId, QuizMode, QuizQuestionKind, Role } from '../common/types/domain.types';
import { CoursesService } from '../courses/courses.service';
import { DatabaseService } from '../database/database.service';
import {
  audioContentType,
  AUDIO_FORMATS_MESSAGE,
  audioVersionParam,
  decodeUploadName,
  serveAudioFile,
} from '../vocabulary/audio-upload';
import { SaveLessonQuizDto } from './dto/lesson-quiz.dto';
import { normalizeQuizQuestion, QuizQuestionPayload } from './lesson-quiz.rules';

export interface LessonQuizQuestionItem {
  id: string;
  lessonId: string;
  kind: QuizQuestionKind;
  vocabularyId: string | null;
  prompt: string | null;
  payload: QuizQuestionPayload;
  audioOverride: boolean;
  hasAudio: boolean;
  audioOriginalName: string | null;
  /** Media API path when the question has its own uploaded audio with override enabled. */
  audioPath: string | null;
  sortOrder: number;
}

export interface LessonQuizConfig {
  lessonId: string;
  quizMode: QuizMode;
  questions: LessonQuizQuestionItem[];
}

@Injectable()
export class LessonQuizService {
  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
    private readonly storage: StorageService,
  ) {}

  /** Teacher/admin view of a lesson's quiz mode and manual questions. */
  async getForTeacher(lessonId: string, user: AuthUser): Promise<LessonQuizConfig> {
    const lesson = await this.loadLesson(lessonId);
    await this.courses.assertCanManageCourse(lesson.course_id, user);
    return {
      lessonId,
      quizMode: lesson.quiz_mode === QuizMode.MANUAL ? QuizMode.MANUAL : QuizMode.AUTO,
      questions: await this.list(lessonId),
    };
  }

  /** Saves quizMode (AUTO | MANUAL) and replaces the lesson's manual question list in one transaction. */
  async save(lessonId: string, dto: SaveLessonQuizDto, user: AuthUser): Promise<LessonQuizConfig> {
    const lesson = await this.loadLesson(lessonId);
    await this.courses.assertCanManageCourse(lesson.course_id, user);

    const normalized = dto.questions.map((q, i) => normalizeQuizQuestion(q, i));
    const ids = normalized.map((q) => q.id).filter((id): id is string => Boolean(id));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Danh sách có một câu hỏi bị gửi hai lần.');
    }

    const removedAudioKeys: string[] = [];
    await this.db.withTransaction(async (tx) => {
      await tx.query('UPDATE lessons SET quiz_mode = $1, updated_at = now() WHERE id = $2', [
        dto.quizMode,
        lessonId,
      ]);

      const vocabRows = (
        await tx.query('SELECT id FROM lesson_vocabulary WHERE lesson_id = $1', [lessonId])
      ).rows as Array<{ id: string }>;
      const validVocabIds = new Set(vocabRows.map((r) => r.id));

      const existingRows = (
        await tx.query(
          'SELECT id, audio_override, audio_storage_key FROM lesson_quiz_questions WHERE lesson_id = $1 FOR UPDATE',
          [lessonId],
        )
      ).rows as Array<{ id: string; audio_override: boolean; audio_storage_key: string | null }>;
      const existing = new Map(existingRows.map((r) => [r.id, r]));

      const keep = ids.filter((id) => existing.has(id));
      const keepSet = new Set(keep);
      for (const row of existingRows) {
        if (!keepSet.has(row.id) && row.audio_storage_key) {
          removedAudioKeys.push(row.audio_storage_key);
        }
      }

      await tx.query('DELETE FROM lesson_quiz_questions WHERE lesson_id = $1 AND NOT (id = ANY($2::varchar[]))', [
        lessonId,
        keep,
      ]);

      for (const [i, item] of normalized.entries()) {
        const vocabId = item.vocabularyId && validVocabIds.has(item.vocabularyId) ? item.vocabularyId : null;
        if (item.id && existing.has(item.id)) {
          const prev = existing.get(item.id)!;
          const nextOverride = item.audioOverride ?? prev.audio_override;
          await tx.query(
            `UPDATE lesson_quiz_questions
             SET kind = $1, vocabulary_id = $2, prompt = $3, payload = $4::jsonb,
                 audio_override = $5, sort_order = $6, updated_at = now()
             WHERE id = $7 AND lesson_id = $8`,
            [
              item.kind,
              vocabId,
              item.prompt,
              JSON.stringify(item.payload),
              nextOverride,
              i,
              item.id,
              lessonId,
            ],
          );
        } else {
          await tx.query(
            `INSERT INTO lesson_quiz_questions
               (id, lesson_id, kind, vocabulary_id, prompt, payload, audio_override, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
            [
              generateId('quizq'),
              lessonId,
              item.kind,
              vocabId,
              item.prompt,
              JSON.stringify(item.payload),
              Boolean(item.audioOverride),
              i,
            ],
          );
        }
      }
    });

    for (const key of removedAudioKeys) {
      await this.storage.deleteFile(key);
    }

    return {
      lessonId,
      quizMode: dto.quizMode,
      questions: await this.list(lessonId),
    };
  }

  /** Uploads/replaces custom override audio for one manual quiz question (used by `listen` questions). */
  async uploadAudio(
    lessonId: string,
    questionId: string,
    file: Express.Multer.File | undefined,
    user: AuthUser,
  ): Promise<LessonQuizQuestionItem> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp âm thanh để tải lên.');
    }
    const lesson = await this.loadLesson(lessonId);
    await this.courses.assertCanManageCourse(lesson.course_id, user);

    const existing = await this.db.queryOne(
      'SELECT * FROM lesson_quiz_questions WHERE id = $1 AND lesson_id = $2',
      [questionId, lessonId],
    );
    if (!existing) {
      throw new NotFoundException('Không tìm thấy câu hỏi quiz trong bài học này.');
    }

    const originalName = decodeUploadName(file.originalname);
    const contentType = audioContentType(originalName);
    if (!contentType) {
      throw new BadRequestException(AUDIO_FORMATS_MESSAGE);
    }

    const key = this.storage.generateStorageKey('audio', originalName);
    await this.storage.saveBuffer(key, file.buffer, contentType);

    let updated: any;
    try {
      updated = await this.db.queryOne(
        `UPDATE lesson_quiz_questions
         SET audio_storage_key = $1, audio_mime_type = $2, audio_original_name = $3,
             audio_override = TRUE, updated_at = now()
         WHERE id = $4 AND lesson_id = $5
         RETURNING *`,
        [key, contentType, originalName.slice(0, 255), questionId, lessonId],
      );
    } catch (err) {
      await this.storage.deleteFile(key);
      throw err;
    }

    if (existing.audio_storage_key) {
      await this.storage.deleteFile(existing.audio_storage_key);
    }
    return this.mapRow(updated);
  }

  async removeAudio(lessonId: string, questionId: string, user: AuthUser): Promise<LessonQuizQuestionItem> {
    const lesson = await this.loadLesson(lessonId);
    await this.courses.assertCanManageCourse(lesson.course_id, user);

    const existing = await this.db.queryOne(
      'SELECT * FROM lesson_quiz_questions WHERE id = $1 AND lesson_id = $2',
      [questionId, lessonId],
    );
    if (!existing) {
      throw new NotFoundException('Không tìm thấy câu hỏi quiz trong bài học này.');
    }

    const updated = await this.db.queryOne(
      `UPDATE lesson_quiz_questions
       SET audio_storage_key = NULL, audio_mime_type = NULL, audio_original_name = NULL,
           audio_override = FALSE, updated_at = now()
       WHERE id = $1 AND lesson_id = $2
       RETURNING *`,
      [questionId, lessonId],
    );
    await this.storage.deleteFile(existing.audio_storage_key);
    return this.mapRow(updated);
  }

  /** Access-checked custom audio for a manual quiz question. */
  async serveAudio(
    lessonId: string,
    questionId: string,
    user: AuthUser | null,
    req: Request,
    res: Response,
  ): Promise<void> {
    const lesson = await this.loadLesson(lessonId);
    const isManager = Boolean(user) && (user!.role === Role.ADMIN || lesson.teacher_id === user!.id);
    if (!lesson.is_published && !isManager) {
      throw new ForbiddenException('Bạn chưa có quyền nghe âm thanh của bài học này.');
    }
    if (!lesson.is_free && !(await this.courses.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException('Bạn chưa có quyền nghe âm thanh của bài học này.');
    }

    const row = await this.db.queryOne(
      'SELECT audio_storage_key, audio_mime_type FROM lesson_quiz_questions WHERE id = $1 AND lesson_id = $2',
      [questionId, lessonId],
    );
    if (!row?.audio_storage_key || !(await this.storage.fileExists(row.audio_storage_key))) {
      throw new NotFoundException('Câu hỏi này chưa có tệp âm thanh ghi đè.');
    }

    await serveAudioFile(this.storage, row.audio_storage_key, row.audio_mime_type, req, res);
  }

  private mapRow(r: any): LessonQuizQuestionItem {
    const hasAudio = Boolean(r.audio_storage_key);
    const audioOverride = Boolean(r.audio_override);
    return {
      id: r.id,
      lessonId: r.lesson_id,
      kind: r.kind,
      vocabularyId: r.vocabulary_id ?? null,
      prompt: r.prompt ?? null,
      payload: r.payload ?? {},
      audioOverride,
      hasAudio,
      audioOriginalName: r.audio_original_name ?? null,
      audioPath:
        audioOverride && hasAudio
          ? `/lessons/${encodeURIComponent(r.lesson_id)}/quiz/${encodeURIComponent(r.id)}/audio${audioVersionParam(r.audio_storage_key)}`
          : null,
      sortOrder: r.sort_order,
    };
  }

  private async list(lessonId: string): Promise<LessonQuizQuestionItem[]> {
    const rows = await this.db.queryAll(
      `SELECT * FROM lesson_quiz_questions WHERE lesson_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [lessonId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  private async loadLesson(lessonId: string) {
    const lesson = await this.db.queryOne(
      `SELECT l.id, l.course_id, l.is_free, l.quiz_mode, c.is_published, c.teacher_id
       FROM lessons l JOIN courses c ON c.id = l.course_id
       WHERE l.id = $1`,
      [lessonId],
    );
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học.');
    return lesson;
  }
}
