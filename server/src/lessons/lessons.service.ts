import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { CoursesService } from '../courses/courses.service';
import { SectionsService } from '../courses/sections.service';
import { StorageService } from '../common/storage/storage.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId, VideoSourceType } from '../common/types/domain.types';
import { extractYouTubeId } from '../common/utils/youtube.util';
import { looksLikeWebVtt } from './subtitle';
import {
  CreateYoutubeLessonDto,
  UpdateLessonDto,
  UploadVideoLessonDto,
} from './dto/lesson.dto';

@Injectable()
export class LessonsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly coursesService: CoursesService,
    private readonly sections: SectionsService,
    private readonly storage: StorageService,
  ) {}

  /** null/undefined = no section; otherwise it must be a section of this course. */
  private async resolveSectionId(sectionId: string | null | undefined, courseId: string): Promise<string | null> {
    if (!sectionId) return null;
    await this.sections.assertSectionInCourse(sectionId, courseId);
    return sectionId;
  }

  private async getNextSortOrder(courseId: string): Promise<number> {
    const row = await this.db.queryOne(
      'SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM lessons WHERE course_id = $1',
      [courseId],
    );
    return (row?.max_order ?? -1) + 1;
  }

  async createYoutubeLesson(dto: CreateYoutubeLessonDto, user: AuthUser) {
    await this.coursesService.assertCanManageCourse(dto.courseId, user);

    const youtubeId = extractYouTubeId(dto.youtubeUrl);
    if (!youtubeId) {
      throw new BadRequestException(
        'Link hoặc ID video YouTube không hợp lệ. Ví dụ: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    }

    const sectionId = await this.resolveSectionId(dto.sectionId, dto.courseId);
    const id = generateId('lesson');
    const sortOrder = dto.sortOrder ?? (await this.getNextSortOrder(dto.courseId));

    return this.db.queryOne(
      `INSERT INTO lessons
         (id, course_id, title, description, duration, sort_order, is_free, source_type, youtube_id, youtube_url, section_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        dto.courseId,
        dto.title.trim(),
        dto.description?.trim() || null,
        dto.duration?.trim() || null,
        sortOrder,
        dto.isFree ?? false,
        VideoSourceType.YOUTUBE,
        youtubeId,
        `https://www.youtube.com/watch?v=${youtubeId}`,
        sectionId,
      ],
    );
  }

  async createUploadedLesson(
    dto: UploadVideoLessonDto,
    file: Express.Multer.File,
    user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp video để tải lên.');
    }

    let sectionId: string | null;
    try {
      await this.coursesService.assertCanManageCourse(dto.courseId, user);
      sectionId = await this.resolveSectionId(dto.sectionId, dto.courseId);
    } catch (err) {
      await this.storage.deleteFile(`videos/${file.filename}`);
      throw err;
    }

    const id = generateId('lesson');
    const storageKey = `videos/${file.filename}`;
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const sortOrder = dto.sortOrder ?? (await this.getNextSortOrder(dto.courseId));

    return this.db.queryOne(
      `INSERT INTO lessons
         (id, course_id, title, description, duration, sort_order, is_free, source_type, storage_key, original_file_name, mime_type, file_size, section_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        dto.courseId,
        dto.title.trim(),
        dto.description?.trim() || null,
        dto.duration?.trim() || null,
        sortOrder,
        dto.isFree ?? false,
        VideoSourceType.UPLOAD,
        storageKey,
        originalName,
        file.mimetype || 'video/mp4',
        file.size,
        sectionId,
      ],
    );
  }

  async updateLesson(id: string, dto: UpdateLessonDto, user: AuthUser) {
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!lesson) {
      throw new NotFoundException('Không tìm thấy bài giảng.');
    }
    await this.coursesService.assertCanManageCourse(lesson.course_id, user);

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
    if (dto.duration !== undefined) {
      sets.push(`duration = $${idx++}`);
      params.push(dto.duration.trim() || null);
    }
    if (dto.isFree !== undefined) {
      sets.push(`is_free = $${idx++}`);
      params.push(dto.isFree);
    }
    if (dto.sectionId !== undefined) {
      sets.push(`section_id = $${idx++}`);
      params.push(await this.resolveSectionId(dto.sectionId, lesson.course_id));
    }

    let oldStorageKeyToDelete: string | null = null;
    if (dto.youtubeUrl !== undefined && dto.youtubeUrl.trim().length > 0) {
      const youtubeId = extractYouTubeId(dto.youtubeUrl);
      if (!youtubeId) {
        throw new BadRequestException(
          'Link hoặc ID video YouTube không hợp lệ. Ví dụ: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        );
      }
      sets.push(`source_type = $${idx++}`);
      params.push(VideoSourceType.YOUTUBE);
      sets.push(`youtube_id = $${idx++}`);
      params.push(youtubeId);
      sets.push(`youtube_url = $${idx++}`);
      params.push(`https://www.youtube.com/watch?v=${youtubeId}`);
      sets.push(`storage_key = NULL, original_file_name = NULL, mime_type = NULL, file_size = NULL`);

      if (lesson.storage_key) {
        oldStorageKeyToDelete = lesson.storage_key;
      }
    }

    params.push(id);
    const updated = await this.db.queryOne(
      `UPDATE lessons SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    if (oldStorageKeyToDelete) {
      await this.storage.deleteFile(oldStorageKeyToDelete);
    }

    return updated;
  }

  async replaceVideoFile(
    id: string,
    dto: UpdateLessonDto,
    file: Express.Multer.File,
    user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp video mới để tải lên.');
    }

    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!lesson) {
      await this.storage.deleteFile(`videos/${file.filename}`);
      throw new NotFoundException('Không tìm thấy bài giảng.');
    }

    try {
      await this.coursesService.assertCanManageCourse(lesson.course_id, user);
    } catch (err) {
      await this.storage.deleteFile(`videos/${file.filename}`);
      throw err;
    }

    const storageKey = `videos/${file.filename}`;
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const updated = await this.db.queryOne(
      `UPDATE lessons
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           duration = COALESCE($3, duration),
           is_free = COALESCE($4, is_free),
           source_type = $5,
           youtube_id = NULL,
           youtube_url = NULL,
           storage_key = $6,
           original_file_name = $7,
           mime_type = $8,
           file_size = $9,
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        dto.title !== undefined ? dto.title.trim() : null,
        dto.description !== undefined ? dto.description.trim() || null : null,
        dto.duration !== undefined ? dto.duration.trim() || null : null,
        dto.isFree !== undefined ? dto.isFree : null,
        VideoSourceType.UPLOAD,
        storageKey,
        originalName,
        file.mimetype || 'video/mp4',
        file.size,
        id,
      ],
    );

    if (lesson.storage_key) {
      await this.storage.deleteFile(lesson.storage_key);
    }

    return updated;
  }

  async reorder(courseId: string, orderedIds: string[], user: AuthUser) {
    await this.coursesService.assertCanManageCourse(courseId, user);
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.query(
        'UPDATE lessons SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND course_id = $3',
        [i, orderedIds[i], courseId],
      );
    }
    return { reordered: true, count: orderedIds.length };
  }

  async streamVideo(
    lessonId: string,
    user: AuthUser | null,
    req: Request,
    res: Response,
  ) {
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [
      lessonId,
    ]);

    if (!lesson || lesson.source_type !== VideoSourceType.UPLOAD || !lesson.storage_key) {
      throw new NotFoundException('Không tìm thấy video tải lên.');
    }

    if (!lesson.is_free) {
      const hasAccess = await this.coursesService.checkUserCourseAccess(
        lesson.course_id,
        user,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'Bạn chưa được cấp quyền xem video của khóa học này.',
        );
      }
    }

    const stat = this.storage.getFileStat(lesson.storage_key);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = lesson.mime_type || 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      });

      this.storage.createReadStream(lesson.storage_key, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      });

      this.storage.createReadStream(lesson.storage_key).pipe(res);
    }
  }

  async saveSubtitle(id: string, file: Express.Multer.File | undefined, user: AuthUser) {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp phụ đề (.vtt).');
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!lesson) throw new NotFoundException('Không tìm thấy bài giảng.');
    await this.coursesService.assertCanManageCourse(lesson.course_id, user);
    if (lesson.source_type !== VideoSourceType.UPLOAD) {
      throw new BadRequestException('Phụ đề chỉ dành cho video tải lên. Video YouTube dùng phụ đề của YouTube.');
    }
    if (!looksLikeWebVtt(file.buffer)) {
      throw new BadRequestException('Tệp không phải WebVTT: dòng đầu phải là "WEBVTT".');
    }

    const key = this.storage.generateStorageKey('subtitles', '.vtt');
    await this.storage.saveBuffer(key, file.buffer);
    try {
      await this.db.query('UPDATE lessons SET subtitle_key = $1, updated_at = NOW() WHERE id = $2', [key, id]);
    } catch (err) {
      await this.storage.deleteFile(key);
      throw err;
    }
    if (lesson.subtitle_key) await this.storage.deleteFile(lesson.subtitle_key);
    return { id, hasSubtitle: true, subtitlePath: `/lessons/${id}/subtitle` };
  }

  async removeSubtitle(id: string, user: AuthUser) {
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!lesson) throw new NotFoundException('Không tìm thấy bài giảng.');
    await this.coursesService.assertCanManageCourse(lesson.course_id, user);
    await this.db.query('UPDATE lessons SET subtitle_key = NULL, updated_at = NOW() WHERE id = $1', [id]);
    await this.storage.deleteFile(lesson.subtitle_key);
    return { id, hasSubtitle: false };
  }

  async serveSubtitle(id: string, user: AuthUser | null, res: Response) {
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (
      !lesson ||
      lesson.source_type !== VideoSourceType.UPLOAD ||
      !lesson.subtitle_key ||
      !this.storage.fileExists(lesson.subtitle_key)
    ) {
      throw new NotFoundException('Bài giảng này chưa có phụ đề.');
    }
    if (!lesson.is_free && !(await this.coursesService.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException('Bạn chưa được cấp quyền xem video của khóa học này.');
    }
    res.writeHead(200, {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Content-Length': this.storage.getFileStat(lesson.subtitle_key).size,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    this.storage.createReadStream(lesson.subtitle_key).pipe(res);
  }

  async remove(id: string, user: AuthUser) {
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!lesson) {
      throw new NotFoundException('Không tìm thấy bài giảng.');
    }

    await this.coursesService.assertCanManageCourse(lesson.course_id, user);
    await this.storage.deleteFile(lesson.storage_key);
    await this.storage.deleteFile(lesson.subtitle_key);
    await this.db.query('DELETE FROM lessons WHERE id = $1', [id]);
    return { deleted: true, id };
  }
}
