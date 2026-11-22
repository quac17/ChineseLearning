import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId } from '../common/types/domain.types';
import { CoursesService } from '../courses/courses.service';
import { DatabaseService } from '../database/database.service';
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
  sortOrder: number;
}

@Injectable()
export class VocabularyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
  ) {}

  /** Same rule as the video: free lessons are public, paid ones need access. */
  async listForViewer(lessonId: string, user: AuthUser | null): Promise<VocabularyItem[]> {
    const lesson = await this.loadLesson(lessonId);
    if (!lesson.is_free && !(await this.courses.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException('Bạn chưa có quyền xem từ vựng của bài học này.');
    }
    return this.list(lessonId);
  }

  /** Replaces the lesson's whole list in one transaction (owner teacher or admin). */
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
        hanzi,
        pinyin,
        meaningVi,
        exampleZh: item.exampleZh?.trim() || null,
        exampleVi: item.exampleVi?.trim() || null,
      };
    });

    await this.db.withTransaction(async (tx) => {
      await tx.query('DELETE FROM lesson_vocabulary WHERE lesson_id = $1', [lessonId]);
      for (const [i, item] of items.entries()) {
        await tx.query(
          `INSERT INTO lesson_vocabulary (id, lesson_id, hanzi, pinyin, meaning_vi, example_zh, example_vi, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [generateId('vocab'), lessonId, item.hanzi, item.pinyin, item.meaningVi, item.exampleZh, item.exampleVi, i],
        );
      }
    });
    return this.list(lessonId);
  }

  private async list(lessonId: string): Promise<VocabularyItem[]> {
    const rows = await this.db.queryAll(
      `SELECT * FROM lesson_vocabulary WHERE lesson_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [lessonId],
    );
    return rows.map((r) => ({
      id: r.id,
      lessonId: r.lesson_id,
      hanzi: r.hanzi,
      pinyin: r.pinyin,
      meaningVi: r.meaning_vi,
      exampleZh: r.example_zh,
      exampleVi: r.example_vi,
      sortOrder: r.sort_order,
    }));
  }

  private async loadLesson(lessonId: string) {
    const lesson = await this.db.queryOne('SELECT id, course_id, is_free FROM lessons WHERE id = $1', [lessonId]);
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học.');
    return lesson;
  }
}
