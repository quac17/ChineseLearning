import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage/storage.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId, ProgramModule, Role } from '../common/types/domain.types';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

/** Escapes LIKE wildcards so "100%" or "a_b" match literally (default escape char is \). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  async checkUserCourseAccess(courseId: string, user: AuthUser | null): Promise<boolean> {
    const course = await this.db.queryOne(
      'SELECT id, is_free, teacher_id FROM courses WHERE id = $1',
      [courseId],
    );
    if (!course) return false;
    if (course.is_free) return true;
    if (!user) return false;
    if (user.role === Role.ADMIN) return true;
    if (user.role === Role.TEACHER && course.teacher_id === user.id) return true;

    const enrollment = await this.db.queryOne(
      `SELECT can_view FROM course_enrollments
       WHERE course_id = $1 AND student_id = $2`,
      [courseId, user.id],
    );

    return Boolean(enrollment?.can_view);
  }

  private async attachCourseRelations(courseRows: any[]) {
    if (courseRows.length === 0) return [];
    const courseIds = courseRows.map((c) => c.id);

    const [lessonsRows, docsRows, enrollRows] = await Promise.all([
      this.db.queryAll(
        `SELECT * FROM lessons
         WHERE course_id = ANY($1::varchar[])
         ORDER BY sort_order ASC, created_at ASC`,
        [courseIds],
      ),
      this.db.queryAll(
        `SELECT * FROM course_documents
         WHERE course_id = ANY($1::varchar[])
         ORDER BY sort_order ASC, created_at ASC`,
        [courseIds],
      ),
      this.db.queryAll(
        `SELECT e.id, e.course_id, e.student_id, e.can_view, u.full_name, u.email
         FROM course_enrollments e
         JOIN users u ON u.id = e.student_id
         WHERE e.course_id = ANY($1::varchar[]) AND e.can_view = TRUE`,
        [courseIds],
      ),
    ]);

    const lessonsByCourse = new Map<string, any[]>();
    for (const l of lessonsRows) {
      const arr = lessonsByCourse.get(l.course_id) || [];
      arr.push(l);
      lessonsByCourse.set(l.course_id, arr);
    }

    const docsByCourse = new Map<string, any[]>();
    for (const d of docsRows) {
      const arr = docsByCourse.get(d.course_id) || [];
      arr.push(d);
      docsByCourse.set(d.course_id, arr);
    }

    const enrollsByCourse = new Map<string, any[]>();
    for (const e of enrollRows) {
      const arr = enrollsByCourse.get(e.course_id) || [];
      arr.push({
        id: e.id,
        studentId: e.student_id,
        canView: e.can_view,
        student: { id: e.student_id, fullName: e.full_name, email: e.email },
      });
      enrollsByCourse.set(e.course_id, arr);
    }

    return courseRows.map((c) => ({
      ...c,
      lessons: lessonsByCourse.get(c.id) || [],
      documents: docsByCourse.get(c.id) || [],
      enrollments: enrollsByCourse.get(c.id) || [],
    }));
  }

  private formatCourseForViewer(
    course: any,
    user: AuthUser | null,
    enrolledCourseIds: Set<string>,
  ) {
    const isAdminOrOwner =
      Boolean(user) &&
      (user.role === Role.ADMIN ||
        (user.role === Role.TEACHER && course.teacher_id === user.id));
    const hasCourseAccess =
      course.is_free || isAdminOrOwner || enrolledCourseIds.has(course.id);

    const lessons = (course.lessons || []).map((lesson: any) => {
      const canWatch = hasCourseAccess || lesson.is_free;
      return {
        id: lesson.id,
        courseId: lesson.course_id,
        title: lesson.title,
        description: lesson.description,
        duration: lesson.duration,
        sortOrder: lesson.sort_order ?? 0,
        isFree: lesson.is_free,
        sourceType: lesson.source_type,
        canWatch,
        youtubeId: canWatch ? lesson.youtube_id : null,
        youtubeUrl: canWatch ? lesson.youtube_url : null,
        streamPath:
          canWatch && lesson.source_type === 'UPLOAD'
            ? `/lessons/${lesson.id}/stream`
            : null,
        originalFileName: lesson.original_file_name,
        fileSize: lesson.file_size,
        createdAt: lesson.created_at,
      };
    });

    const documents = (course.documents || []).map((doc: any) => {
      const canDownload = hasCourseAccess || doc.is_free;
      return {
        id: doc.id,
        courseId: doc.course_id,
        title: doc.title,
        description: doc.description,
        originalFileName: doc.original_file_name,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        sortOrder: doc.sort_order ?? 0,
        isFree: doc.is_free,
        canDownload,
        downloadPath: canDownload ? `/documents/${doc.id}/download` : null,
        createdAt: doc.created_at,
      };
    });

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      module: course.module as ProgramModule,
      sortOrder: course.sort_order ?? 0,
      isFree: course.is_free,
      isPublished: course.is_published,
      priceVnd: course.price_vnd ?? null,
      teacherId: course.teacher_id,
      teacher: {
        id: course.teacher_id,
        fullName: course.teacher_name,
        email: course.teacher_email,
        bio: course.teacher_bio ?? null,
      },
      hasAccess: hasCourseAccess,
      createdAt: course.created_at,
      lessons,
      documents,
    };
  }

  /**
   * Published courses, optionally filtered by program and a search term that
   * matches the title, description or teacher name (case-insensitive).
   */
  async findAll(
    moduleFilter: string | undefined,
    search: string | undefined,
    user: AuthUser | null,
  ) {
    const where = ['c.is_published = TRUE'];
    const params: unknown[] = [];

    if (moduleFilter && ['easy', 'yct', 'hsk', 'talk'].includes(moduleFilter)) {
      params.push(moduleFilter);
      where.push(`c.module = $${params.length}`);
    }

    const q = typeof search === 'string' ? search.trim().slice(0, 100) : '';
    if (q) {
      params.push(`%${escapeLike(q)}%`);
      const p = `$${params.length}`;
      where.push(`(c.title ILIKE ${p} OR c.description ILIKE ${p} OR u.full_name ILIKE ${p})`);
    }

    const courseRows = await this.db.queryAll(
      `SELECT c.*, u.full_name AS teacher_name, u.email AS teacher_email, u.bio AS teacher_bio
       FROM courses c
       JOIN users u ON u.id = c.teacher_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.sort_order ASC, c.created_at ASC`,
      params,
    );

    const [enriched, enrollments] = await Promise.all([
      this.attachCourseRelations(courseRows),
      user
        ? this.db.queryAll(
            `SELECT course_id FROM course_enrollments
             WHERE student_id = $1 AND can_view = TRUE`,
            [user.id],
          )
        : Promise.resolve([]),
    ]);

    const enrolledSet = new Set(enrollments.map((e) => e.course_id));
    return enriched.map((c) => this.formatCourseForViewer(c, user, enrolledSet));
  }

  async findManageable(user: AuthUser) {
    const courseRows =
      user.role === Role.ADMIN
        ? await this.db.queryAll(
            `SELECT c.*, u.full_name AS teacher_name, u.email AS teacher_email, u.bio AS teacher_bio
             FROM courses c
             JOIN users u ON u.id = c.teacher_id
             ORDER BY c.sort_order ASC, c.created_at ASC`,
          )
        : await this.db.queryAll(
            `SELECT c.*, u.full_name AS teacher_name, u.email AS teacher_email, u.bio AS teacher_bio
             FROM courses c
             JOIN users u ON u.id = c.teacher_id
             WHERE c.teacher_id = $1
             ORDER BY c.sort_order ASC, c.created_at ASC`,
            [user.id],
          );

    const enriched = await this.attachCourseRelations(courseRows);
    return enriched.map((c) => ({
      ...this.formatCourseForViewer(c, user, new Set()),
      enrollments: c.enrollments,
    }));
  }

  async findOne(id: string, user: AuthUser | null) {
    const row = await this.db.queryOne(
      `SELECT c.*, u.full_name AS teacher_name, u.email AS teacher_email, u.bio AS teacher_bio
       FROM courses c
       JOIN users u ON u.id = c.teacher_id
       WHERE c.id = $1`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Không tìm thấy khóa học.');
    }

    const [enriched, enrollments] = await Promise.all([
      this.attachCourseRelations([row]),
      user
        ? this.db.queryAll(
            `SELECT course_id FROM course_enrollments
             WHERE student_id = $1 AND course_id = $2 AND can_view = TRUE`,
            [user.id, id],
          )
        : Promise.resolve([]),
    ]);

    return this.formatCourseForViewer(
      enriched[0],
      user,
      new Set(enrollments.map((e) => e.course_id)),
    );
  }

  async setPrice(id: string, priceVnd: number | null) {
    const row = await this.db.queryOne(
      'UPDATE courses SET price_vnd = $1, updated_at = NOW() WHERE id = $2 RETURNING id, price_vnd',
      [priceVnd, id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy khóa học.');
    return { id: row.id, priceVnd: row.price_vnd };
  }

  async create(dto: CreateCourseDto, user: AuthUser) {
    const id = generateId('course');
    const maxRow = await this.db.queryOne(
      'SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM courses',
    );
    const nextOrder = (maxRow?.max_order ?? -1) + 1;

    const created = await this.db.queryOne(
      `INSERT INTO courses (id, title, description, module, sort_order, is_free, is_published, teacher_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        dto.title.trim(),
        dto.description?.trim() || null,
        dto.module,
        nextOrder,
        dto.isFree ?? false,
        dto.isPublished ?? true,
        user.id,
      ],
    );

    return {
      id: created.id,
      title: created.title,
      description: created.description,
      module: created.module,
      sortOrder: created.sort_order,
      isFree: created.is_free,
      isPublished: created.is_published,
      teacherId: created.teacher_id,
      teacher: { id: user.id, fullName: user.fullName, email: user.email },
      hasAccess: true,
      createdAt: created.created_at,
      lessons: [],
      documents: [],
    };
  }

  async assertCanManageCourse(courseId: string, user: AuthUser) {
    const course = await this.db.queryOne('SELECT * FROM courses WHERE id = $1', [
      courseId,
    ]);
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học.');
    }
    if (user.role !== Role.ADMIN && course.teacher_id !== user.id) {
      throw new ForbiddenException('Bạn chỉ có thể quản lý khóa học do mình phụ trách.');
    }
    return course;
  }

  async update(id: string, dto: UpdateCourseDto, user: AuthUser) {
    await this.assertCanManageCourse(id, user);

    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.title !== undefined) {
      sets.push(`title = $${idx++}`);
      params.push(dto.title.trim());
    }
    if (dto.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(dto.description.trim() || null);
    }
    if (dto.module !== undefined) {
      sets.push(`module = $${idx++}`);
      params.push(dto.module);
    }
    if (dto.isFree !== undefined) {
      sets.push(`is_free = $${idx++}`);
      params.push(dto.isFree);
    }
    if (dto.isPublished !== undefined) {
      sets.push(`is_published = $${idx++}`);
      params.push(dto.isPublished);
    }

    params.push(id);
    const updated = await this.db.queryOne(
      `UPDATE courses SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return updated;
  }

  async reorder(orderedIds: string[], user: AuthUser) {
    for (let i = 0; i < orderedIds.length; i++) {
      const courseId = orderedIds[i];
      await this.assertCanManageCourse(courseId, user);
      await this.db.query(
        'UPDATE courses SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [i, courseId],
      );
    }
    return { reordered: true, count: orderedIds.length };
  }

  async remove(id: string, user: AuthUser) {
    await this.assertCanManageCourse(id, user);

    const [lessons, docs] = await Promise.all([
      this.db.queryAll('SELECT storage_key FROM lessons WHERE course_id = $1', [id]),
      this.db.queryAll('SELECT storage_key FROM course_documents WHERE course_id = $1', [
        id,
      ]),
    ]);

    for (const l of lessons) await this.storage.deleteFile(l.storage_key);
    for (const d of docs) await this.storage.deleteFile(d.storage_key);

    await this.db.query('DELETE FROM courses WHERE id = $1', [id]);
    return { deleted: true, id };
  }
}
