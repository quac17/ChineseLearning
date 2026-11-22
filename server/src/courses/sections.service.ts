import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId } from '../common/types/domain.types';
import { DatabaseService } from '../database/database.service';
import { CoursesService } from './courses.service';

export interface SectionView {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
}

/** True when `ids` lists every id of `existing` exactly once (any order). */
export function isSameIdSet(ids: string[], existing: string[]): boolean {
  if (ids.length !== existing.length) return false;
  const want = new Set(existing);
  const seen = new Set<string>();
  for (const id of ids) {
    if (!want.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** Sections ("Phần") of a course. Every write is for the owner teacher or an admin. */
@Injectable()
export class SectionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly courses: CoursesService,
  ) {}

  private toView(row: any): SectionView {
    return { id: row.id, courseId: row.course_id, title: row.title, sortOrder: row.sort_order };
  }

  async create(courseId: string, title: string, user: AuthUser): Promise<SectionView> {
    await this.courses.assertCanManageCourse(courseId, user);
    const row = await this.db.queryOne(
      `INSERT INTO course_sections (id, course_id, title, sort_order)
       VALUES ($1, $2::varchar, $3, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM course_sections WHERE course_id = $2::varchar))
       RETURNING *`,
      [generateId('section'), courseId, title],
    );
    return this.toView(row);
  }

  async rename(courseId: string, sectionId: string, title: string, user: AuthUser): Promise<SectionView> {
    await this.courses.assertCanManageCourse(courseId, user);
    const row = await this.db.queryOne(
      `UPDATE course_sections SET title = $1, updated_at = NOW()
       WHERE id = $2 AND course_id = $3 RETURNING *`,
      [title, sectionId, courseId],
    );
    if (!row) throw new NotFoundException('Không tìm thấy phần này trong khoá học.');
    return this.toView(row);
  }

  /** Deletes the section only; its lessons stay in the course without a section. */
  async remove(courseId: string, sectionId: string, user: AuthUser) {
    await this.courses.assertCanManageCourse(courseId, user);
    const row = await this.db.queryOne(
      'DELETE FROM course_sections WHERE id = $1 AND course_id = $2 RETURNING id',
      [sectionId, courseId],
    );
    if (!row) throw new NotFoundException('Không tìm thấy phần này trong khoá học.');
    return { deleted: true, id: sectionId };
  }

  /** `orderedIds` must list every section of the course exactly once. */
  async reorder(courseId: string, orderedIds: string[], user: AuthUser): Promise<SectionView[]> {
    await this.courses.assertCanManageCourse(courseId, user);
    return this.db.withTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM course_sections WHERE course_id = $1 FOR UPDATE', [courseId]);
      if (!isSameIdSet(orderedIds, existing.rows.map((r) => r.id))) {
        throw new BadRequestException('Danh sách phần phải gồm đúng mọi phần của khoá học, mỗi phần một lần.');
      }
      const rows: SectionView[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const res = await client.query(
          'UPDATE course_sections SET sort_order = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [i, orderedIds[i]],
        );
        rows.push(this.toView(res.rows[0]));
      }
      return rows;
    });
  }

  /** Throws unless `sectionId` is a section of `courseId` (lessons only join their own course's sections). */
  async assertSectionInCourse(sectionId: string, courseId: string): Promise<void> {
    const row = await this.db.queryOne('SELECT 1 FROM course_sections WHERE id = $1 AND course_id = $2', [
      sectionId,
      courseId,
    ]);
    if (!row) throw new BadRequestException('Phần này không thuộc khoá học của bài giảng.');
  }
}
