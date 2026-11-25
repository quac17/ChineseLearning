import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { StorageService } from '../common/storage/storage.service';
import { generateId, Role } from '../common/types/domain.types';
import { CoursesService } from '../courses/courses.service';
import { DatabaseService } from '../database/database.service';
import {
  audioContentType,
  AUDIO_FORMATS_MESSAGE,
  audioVersionParam,
  decodeUploadName,
  serveAudioFile,
} from './audio-upload';
import { SaveVocabularyDto } from './dto/vocabulary.dto';
import { normalizePinyin } from './pinyin';

export interface VocabularyItem {
  id: string;
  lessonId: string;
  hanzi: string;
  pinyin: string;
  meaningVi: string;
  exampleZh: string | null;
  exampleVi: string | null;
  audioOverride: boolean;
  hasAudio: boolean;
  audioOriginalName: string | null;
  /** Media API path when audioOverride is enabled and an audio file exists; null = use built-in TTS. */
  audioPath: string | null;
  sortOrder: number;
}

@Injectable()
export class VocabularyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
    private readonly storage: StorageService,
  ) {}

  /** Same rule as the video: free lessons in published courses are public, paid ones need access. */
  async listForViewer(lessonId: string, user: AuthUser | null): Promise<VocabularyItem[]> {
    const lesson = await this.loadLesson(lessonId);
    await this.assertCanReadLesson(lesson, user, 'Bạn chưa có quyền xem từ vựng của bài học này.');
    return this.list(lessonId);
  }

  /**
   * Saves the lesson's whole list in one transaction (owner teacher or admin):
   * words sent with their id are updated in place, words without one are
   * added, and words left out are deleted (along with their uploaded audio).
   */
  async save(lessonId: string, dto: SaveVocabularyDto, user: AuthUser): Promise<VocabularyItem[]> {
    const lesson = await this.loadLesson(lessonId);
    await this.courses.assertCanManageCourse(lesson.course_id, user);

    const items = dto.items.map((item, i) => {
      const hanzi = item.hanzi.trim();
      const pinyin = normalizePinyin(item.pinyin);
      const meaningVi = item.meaningVi.trim();
      if (!hanzi || !pinyin || !meaningVi) {
        throw new BadRequestException(`Dòng ${i + 1}: cần đủ chữ Hán, pinyin và nghĩa.`);
      }
      return {
        id: item.id?.trim() || null,
        hanzi,
        pinyin,
        meaningVi,
        exampleZh: item.exampleZh?.trim() || null,
        exampleVi: item.exampleVi?.trim() || null,
        audioOverride: item.audioOverride,
      };
    });

    const ids = items.map((i) => i.id).filter((id): id is string => Boolean(id));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Danh sách có một từ bị gửi hai lần.');
    }

    const removedAudioKeys: string[] = [];
    await this.db.withTransaction(async (tx) => {
      const existingRows = (
        await tx.query(
          'SELECT id, audio_override, audio_storage_key FROM lesson_vocabulary WHERE lesson_id = $1 FOR UPDATE',
          [lessonId],
        )
      ).rows as Array<{ id: string; audio_override: boolean; audio_storage_key: string | null }>;
      const existing = new Map(existingRows.map((r) => [r.id, r]));

      // An id from another lesson (or a stale one) is treated as a new word.
      const keep = ids.filter((id) => existing.has(id));
      const keepSet = new Set(keep);
      for (const row of existingRows) {
        if (!keepSet.has(row.id) && row.audio_storage_key) {
          removedAudioKeys.push(row.audio_storage_key);
        }
      }

      // Only words the teacher removed are deleted, so only they lose learners' progress.
      await tx.query('DELETE FROM lesson_vocabulary WHERE lesson_id = $1 AND NOT (id = ANY($2::varchar[]))', [
        lessonId,
        keep,
      ]);
      for (const [i, item] of items.entries()) {
        if (item.id && existing.has(item.id)) {
          const prev = existing.get(item.id)!;
          const nextOverride = item.audioOverride ?? prev.audio_override;
          await tx.query(
            `UPDATE lesson_vocabulary
             SET hanzi = $1, pinyin = $2, meaning_vi = $3, example_zh = $4, example_vi = $5,
                 audio_override = $6, sort_order = $7, updated_at = now()
             WHERE id = $8 AND lesson_id = $9`,
            [
              item.hanzi,
              item.pinyin,
              item.meaningVi,
              item.exampleZh,
              item.exampleVi,
              nextOverride,
              i,
              item.id,
              lessonId,
            ],
          );
        } else {
          await tx.query(
            `INSERT INTO lesson_vocabulary
               (id, lesson_id, hanzi, pinyin, meaning_vi, example_zh, example_vi, audio_override, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              generateId('vocab'),
              lessonId,
              item.hanzi,
              item.pinyin,
              item.meaningVi,
              item.exampleZh,
              item.exampleVi,
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
    return this.list(lessonId);
  }

  /** Uploads/replaces the custom audio override file for a vocabulary word. */
  async uploadAudio(
    lessonId: string,
    vocabId: string,
    file: Express.Multer.File | undefined,
    user: AuthUser,
  ): Promise<VocabularyItem> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp âm thanh để tải lên.');
    }
    const lesson = await this.loadLesson(lessonId);
    await this.courses.assertCanManageCourse(lesson.course_id, user);

    const existing = await this.db.queryOne(
      'SELECT * FROM lesson_vocabulary WHERE id = $1 AND lesson_id = $2',
      [vocabId, lessonId],
    );
    if (!existing) {
      throw new NotFoundException('Không tìm thấy từ vựng trong bài học này.');
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
        `UPDATE lesson_vocabulary
         SET audio_storage_key = $1, audio_mime_type = $2, audio_original_name = $3,
             audio_override = TRUE, updated_at = now()
         WHERE id = $4 AND lesson_id = $5
         RETURNING *`,
        [key, contentType, originalName.slice(0, 255), vocabId, lessonId],
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

  /** Removes the custom audio override file and falls back to built-in TTS. */
  async removeAudio(lessonId: string, vocabId: string, user: AuthUser): Promise<VocabularyItem> {
    const lesson = await this.loadLesson(lessonId);
    await this.courses.assertCanManageCourse(lesson.course_id, user);

    const existing = await this.db.queryOne(
      'SELECT * FROM lesson_vocabulary WHERE id = $1 AND lesson_id = $2',
      [vocabId, lessonId],
    );
    if (!existing) {
      throw new NotFoundException('Không tìm thấy từ vựng trong bài học này.');
    }

    const updated = await this.db.queryOne(
      `UPDATE lesson_vocabulary
       SET audio_storage_key = NULL, audio_mime_type = NULL, audio_original_name = NULL,
           audio_override = FALSE, updated_at = now()
       WHERE id = $1 AND lesson_id = $2
       RETURNING *`,
      [vocabId, lessonId],
    );
    await this.storage.deleteFile(existing.audio_storage_key);
    return this.mapRow(updated);
  }

  /** Streams or redirects (GCS signed URL) to a vocabulary word's custom audio after checking access. */
  async serveAudio(
    lessonId: string,
    vocabId: string,
    user: AuthUser | null,
    req: Request,
    res: Response,
  ): Promise<void> {
    const lesson = await this.loadLesson(lessonId);
    await this.assertCanReadLesson(lesson, user, 'Bạn chưa có quyền nghe âm thanh của bài học này.');

    const vocab = await this.db.queryOne(
      'SELECT audio_storage_key, audio_mime_type FROM lesson_vocabulary WHERE id = $1 AND lesson_id = $2',
      [vocabId, lessonId],
    );
    if (!vocab?.audio_storage_key || !(await this.storage.fileExists(vocab.audio_storage_key))) {
      throw new NotFoundException('Từ vựng này chưa có tệp âm thanh ghi đè.');
    }

    await serveAudioFile(this.storage, vocab.audio_storage_key, vocab.audio_mime_type, req, res);
  }

  private mapRow(r: any): VocabularyItem {
    const hasAudio = Boolean(r.audio_storage_key);
    const audioOverride = Boolean(r.audio_override);
    return {
      id: r.id,
      lessonId: r.lesson_id,
      hanzi: r.hanzi,
      pinyin: r.pinyin,
      meaningVi: r.meaning_vi,
      exampleZh: r.example_zh,
      exampleVi: r.example_vi,
      audioOverride,
      hasAudio,
      audioOriginalName: r.audio_original_name ?? null,
      audioPath:
        audioOverride && hasAudio
          ? `/lessons/${encodeURIComponent(r.lesson_id)}/vocabulary/${encodeURIComponent(r.id)}/audio${audioVersionParam(r.audio_storage_key)}`
          : null,
      sortOrder: r.sort_order,
    };
  }

  private async list(lessonId: string): Promise<VocabularyItem[]> {
    const rows = await this.db.queryAll(
      `SELECT * FROM lesson_vocabulary WHERE lesson_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [lessonId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  private async loadLesson(lessonId: string) {
    const lesson = await this.db.queryOne(
      `SELECT l.id, l.course_id, l.is_free, c.is_published, c.teacher_id
       FROM lessons l JOIN courses c ON c.id = l.course_id
       WHERE l.id = $1`,
      [lessonId],
    );
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học.');
    return lesson;
  }

  private async assertCanReadLesson(
    lesson: { course_id: string; is_free: boolean; is_published: boolean; teacher_id: string },
    user: AuthUser | null,
    message: string,
  ) {
    const isManager = Boolean(user) && (user!.role === Role.ADMIN || lesson.teacher_id === user!.id);
    if (!lesson.is_published && !isManager) {
      throw new ForbiddenException(message);
    }
    if (!lesson.is_free && !(await this.courses.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException(message);
    }
  }
}
