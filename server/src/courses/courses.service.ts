import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage/storage.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId, ProgramModule, Role } from '../common/types/domain.types';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { courseSearchClause, courseSearchPattern } from './course-search';
import { buildOutline } from './course-outline';
import { checkRating } from './course-proof';
import { reviewSummary } from '../reviews/reviews.rules';
import { COVER_CONTENT_TYPES, CoverImageType, detectImageType, normalizeOutcomes, sumDurationMinutes } from './course-meta';

/** Public cover path with a version from the storage key, so a new upload is never served from cache. */
function coverPath(courseId: string, coverKey: string | null | undefined): string | null {
  if (!coverKey) return null;
  const version = path.basename(coverKey).split('.')[0];
  return `/courses/${encodeURIComponent(courseId)}/cover?v=${encodeURIComponent(version)}`;
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
    if (user.role === Role.ADMIN || (user.role === Role.TEACHER && course.teacher_id === user.id)) return true;

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

    const [lessonsRows, docsRows, enrollRows, sectionRows, reviewRows] = await Promise.all([
      this.db.queryAll(
        `SELECT l.*,
                (SELECT count(*)::int FROM lesson_vocabulary v WHERE v.lesson_id = l.id) AS vocabulary_count
         FROM lessons l
         WHERE l.course_id = ANY($1::varchar[])
         ORDER BY l.sort_order ASC, l.created_at ASC`,
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
      this.db.queryAll(
        `SELECT id, course_id, title, sort_order, created_at FROM course_sections
         WHERE course_id = ANY($1::varchar[])`,
        [courseIds],
      ),
      this.db.queryAll(
        `SELECT course_id, count(*)::int AS count, avg(stars) AS average FROM course_reviews
         WHERE course_id = ANY($1::varchar[]) AND is_hidden = FALSE
         GROUP BY course_id`,
        [courseIds],
      ),
    ]);
    const reviewsByCourse = new Map(reviewRows.map((r) => [r.course_id, r]));

    const sectionsByCourse = new Map<string, any[]>();
    for (const sec of sectionRows) {
      const arr = sectionsByCourse.get(sec.course_id) || [];
      arr.push(sec);
      sectionsByCourse.set(sec.course_id, arr);
    }

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

    return courseRows.map((c) => {
      const outline = buildOutline(sectionsByCourse.get(c.id) || [], lessonsByCourse.get(c.id) || []);
      return {
        ...c,
        sections: outline.sections,
        lessons: outline.lessons,
        documents: docsByCourse.get(c.id) || [],
        enrollments: enrollsByCourse.get(c.id) || [],
        reviewStats: reviewsByCourse.get(c.id) ?? null,
      };
    });
  }

  private formatCourseForViewer(
    course: any,
    user: AuthUser | null,
    enrolledCourseIds: Set<string>,
  ) {
    const isAdminOrTeacher =
      Boolean(user) &&
      (user.role === Role.ADMIN || user.role === Role.TEACHER);
    const hasCourseAccess =
      course.is_free || isAdminOrTeacher || enrolledCourseIds.has(course.id);

    const lessons = (course.lessons || []).map((lesson: any) => {
      const canWatch = hasCourseAccess || lesson.is_free;
      return {
        id: lesson.id,
        courseId: lesson.course_id,
        title: lesson.title,
        description: lesson.description,
        duration: lesson.duration,
        durationMinutes: lesson.duration_minutes ?? null,
        sortOrder: lesson.sort_order ?? 0,
        sectionId: lesson.section_id ?? null,
        isFree: lesson.is_free,
        sourceType: lesson.source_type,
        canWatch,
        youtubeId: canWatch ? lesson.youtube_id : null,
        youtubeUrl: canWatch ? lesson.youtube_url : null,
        streamPath:
          canWatch && lesson.source_type === 'UPLOAD'
            ? `/lessons/${lesson.id}/stream`
            : null,
        subtitlePath:
          canWatch && lesson.source_type === 'UPLOAD' && lesson.subtitle_key
            ? `/lessons/${lesson.id}/subtitle`
            : null,
        originalFileName: lesson.original_file_name,
        fileSize: lesson.file_size,
        vocabularyCount: lesson.vocabulary_count ?? 0,
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

    const { totalMinutes } = sumDurationMinutes(course.lessons || []);

    return {
      id: course.id,
      title: course.title,
      subtitle: course.subtitle ?? null,
      description: course.description,
      module: course.module as ProgramModule,
      level: course.level ?? null,
      outcomes: course.outcomes ?? [],
      /** Public image path (covers are marketing, not paid content); null = program colour. */
      coverUrl: coverPath(course.id, course.cover_key),
      /** Sum of the lessons that have minutes. */
      totalDurationMinutes: totalMinutes,
      /** Shown only with its stated source; null = hide the rating block. */
      rating:
        course.rating_value != null && course.rating_source
          ? { value: Number(course.rating_value), source: course.rating_source }
          : null,
      /**
       * Real reviews from learners who bought the course (#41), never merged
       * with the sourced `rating`. `average` is null below REVIEWS_MIN_TO_SHOW.
       */
      reviews: reviewSummary(course.reviewStats?.count ?? 0, course.reviewStats?.average ?? null),
      /** Accounts that can open the course right now (open enrollments). */
      learnerCount: (course.enrollments || []).length,
      /** Offline-class learners, shown apart ("+80 lớp offline"), never added to learnerCount. */
      offlineLearnerCount: course.offline_learner_count ?? null,
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
      updatedAt: course.updated_at,
      /** Sections in order with their lesson ids; empty = flat lesson list. */
      sections: course.sections || [],
      /** Already in display order (section by section, unassigned last). */
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

    if (moduleFilter && moduleFilter !== 'all') {
      params.push(moduleFilter);
      where.push(`c.module = $${params.length}`);
    }

    const pattern = courseSearchPattern(search);
    if (pattern) {
      params.push(pattern);
      where.push(`(${courseSearchClause(`$${params.length}`)})`);
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

    const course = this.formatCourseForViewer(
      enriched[0],
      user,
      new Set(enrollments.map((e) => e.course_id)),
    );
    // Who can view the course is shown to its manager only (course editor).
    const canManage =
      Boolean(user) &&
      (user.role === Role.ADMIN || (user.role === Role.TEACHER && row.teacher_id === user.id));
    return canManage ? { ...course, enrollments: enriched[0].enrollments } : course;
  }

  async setPrice(id: string, priceVnd: number | null) {
    const row = await this.db.queryOne(
      'UPDATE courses SET price_vnd = $1, updated_at = NOW() WHERE id = $2 RETURNING id, price_vnd',
      [priceVnd, id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy khóa học.');
    return { id: row.id, priceVnd: row.price_vnd };
  }

  async setRating(id: string, ratingValue: number | null | undefined, ratingSource: string | null | undefined) {
    const checked = checkRating({ ratingValue, ratingSource });
    if ('message' in checked) throw new BadRequestException(checked.message);
    const row = await this.db.queryOne(
      `UPDATE courses SET rating_value = $1, rating_source = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, rating_value, rating_source`,
      [checked.ratingValue, checked.ratingSource, id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy khóa học.');
    return {
      id: row.id,
      rating: row.rating_value != null ? { value: Number(row.rating_value), source: row.rating_source } : null,
    };
  }

  async setOfflineLearners(id: string, count: number | null) {
    const row = await this.db.queryOne(
      'UPDATE courses SET offline_learner_count = $1, updated_at = NOW() WHERE id = $2 RETURNING id, offline_learner_count',
      [count, id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy khóa học.');
    return { id: row.id, offlineLearnerCount: row.offline_learner_count };
  }

  private async assertProgramExists(code: string) {
    const row = await this.db.queryOne('SELECT code FROM program_modules WHERE code = $1', [code]);
    if (!row) {
      throw new BadRequestException('Chương trình học không tồn tại.');
    }
  }

  async create(dto: CreateCourseDto, user: AuthUser) {
    await this.assertProgramExists(dto.module);
    const id = generateId('course');
    const maxRow = await this.db.queryOne(
      'SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM courses',
    );
    const nextOrder = (maxRow?.max_order ?? -1) + 1;

    const created = await this.db.queryOne(
      `INSERT INTO courses (id, title, description, module, sort_order, is_free, is_published, teacher_id, subtitle, level, outcomes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        dto.subtitle ?? null,
        dto.level ?? null,
        normalizeOutcomes(dto.outcomes ?? []),
      ],
    );

    return {
      id: created.id,
      title: created.title,
      subtitle: created.subtitle,
      description: created.description,
      module: created.module,
      level: created.level,
      outcomes: created.outcomes,
      coverUrl: null,
      totalDurationMinutes: 0,
      rating: null,
      reviews: { average: null, count: 0 },
      learnerCount: 0,
      offlineLearnerCount: null,
      sortOrder: created.sort_order,
      isFree: created.is_free,
      isPublished: created.is_published,
      teacherId: created.teacher_id,
      teacher: { id: user.id, fullName: user.fullName, email: user.email },
      hasAccess: true,
      createdAt: created.created_at,
      sections: [],
      lessons: [],
      documents: [],
    };
  }

  /**
   * Stores a new cover (JPEG, PNG or WebP, checked by its bytes) under a
   * server-generated key and removes the previous file.
   */
  async setCover(courseId: string, file: Express.Multer.File | undefined, user: AuthUser) {
    if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn ảnh bìa để tải lên.');
    const course = await this.assertCanManageCourse(courseId, user);
    const type = detectImageType(file.buffer);
    if (!type) throw new BadRequestException('Ảnh bìa phải là tệp JPG, PNG hoặc WebP.');

    const key = this.storage.generateStorageKey('covers', `cover.${type}`);
    await this.storage.saveBuffer(key, file.buffer, COVER_CONTENT_TYPES[type]);
    try {
      await this.db.query('UPDATE courses SET cover_key = $1, updated_at = NOW() WHERE id = $2', [key, courseId]);
    } catch (err) {
      await this.storage.deleteFile(key);
      throw err;
    }
    if (course.cover_key && course.cover_key !== key) await this.storage.deleteFile(course.cover_key);
    return { id: courseId, coverUrl: coverPath(courseId, key) };
  }

  async removeCover(courseId: string, user: AuthUser) {
    const course = await this.assertCanManageCourse(courseId, user);
    await this.db.query('UPDATE courses SET cover_key = NULL, updated_at = NOW() WHERE id = $1', [courseId]);
    await this.storage.deleteFile(course.cover_key);
    return { id: courseId, coverUrl: null };
  }

  /** The cover file to stream (public). */
  async getCover(courseId: string): Promise<{ key: string; contentType: string }> {
    const row = await this.db.queryOne('SELECT cover_key FROM courses WHERE id = $1', [courseId]);
    if (!row?.cover_key || !(await this.storage.fileExists(row.cover_key))) {
      throw new NotFoundException('Khoá học chưa có ảnh bìa.');
    }
    const ext = path.extname(row.cover_key).slice(1) as CoverImageType;
    return { key: row.cover_key, contentType: COVER_CONTENT_TYPES[ext] ?? 'application/octet-stream' };
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
      await this.assertProgramExists(dto.module);
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
    if (dto.subtitle !== undefined) {
      sets.push(`subtitle = $${idx++}`);
      params.push(dto.subtitle);
    }
    if (dto.level !== undefined) {
      sets.push(`level = $${idx++}`);
      params.push(dto.level);
    }
    if (dto.outcomes !== undefined) {
      sets.push(`outcomes = $${idx++}`);
      params.push(normalizeOutcomes(dto.outcomes));
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

    // Learners who bought or were granted the course must not lose it to a
    // teacher's click; an admin can still delete (after refunds, for example).
    if (user.role !== Role.ADMIN) {
      const learners = await this.db.queryOne(
        'SELECT count(*)::int AS n FROM course_enrollments WHERE course_id = $1 AND can_view = TRUE',
        [id],
      );
      if (learners?.n > 0) {
        throw new BadRequestException(
          'Khoá học đã có học viên nên không thể xoá. Hãy chuyển về bản nháp hoặc liên hệ admin.',
        );
      }
    }

    const [lessons, docs] = await Promise.all([
      this.db.queryAll('SELECT storage_key, subtitle_key FROM lessons WHERE course_id = $1', [id]),
      this.db.queryAll('SELECT storage_key FROM course_documents WHERE course_id = $1', [
        id,
      ]),
    ]);

    const course = await this.db.queryOne('SELECT cover_key FROM courses WHERE id = $1', [id]);
    for (const l of lessons) {
      await this.storage.deleteFile(l.storage_key);
      await this.storage.deleteFile(l.subtitle_key);
    }
    for (const d of docs) await this.storage.deleteFile(d.storage_key);
    await this.storage.deleteFile(course?.cover_key);

    await this.db.query('DELETE FROM courses WHERE id = $1', [id]);
    return { deleted: true, id };
  }
}
