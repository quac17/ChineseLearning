import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { CoursesService } from '../courses/courses.service';
import { SectionsService } from '../courses/sections.service';
import { parseDurationMinutes } from '../courses/course-meta';
import { StorageService } from '../common/storage/storage.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId, VideoSourceType } from '../common/types/domain.types';
import { extractYouTubeId } from '../common/utils/youtube.util';
import { looksLikeWebVtt } from './subtitle';
import {
  ConfirmVideoReplaceDto,
  ConfirmVideoUploadDto,
  CreateYoutubeLessonDto,
  RequestVideoUploadDto,
  UpdateLessonDto,
  UploadVideoLessonDto,
} from './dto/lesson.dto';
import {
  isAcceptableVideoMime,
  isVideoStorageKey,
  maxVideoBytes,
  signUploadToken,
  verifyUploadToken,
  videoContentType,
  VIDEO_FORMATS_MESSAGE,
} from './video-upload';

/** The stored video file of a lesson, wherever it was uploaded from. */
interface StoredVideo {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/** Multer reports the file name in latin1; the browser sent UTF-8. */
function multerFileName(file: Express.Multer.File): string {
  return Buffer.from(file.originalname, 'latin1').toString('utf8');
}

@Injectable()
export class LessonsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly coursesService: CoursesService,
    private readonly sections: SectionsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private uploadSecret(): string {
    return this.config.get<string>('JWT_SECRET') || 'dev_jwt_secret';
  }

  /** Explicit minutes win; otherwise read them from the free-text duration. */
  private minutesFor(dto: { durationMinutes?: number | null; duration?: string }): number | null {
    if (dto.durationMinutes !== undefined) return dto.durationMinutes;
    return parseDurationMinutes(dto.duration);
  }

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
         (id, course_id, title, description, duration, sort_order, is_free, source_type, youtube_id, youtube_url, section_id, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        this.minutesFor(dto),
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

    const storageKey = `videos/${file.filename}`;
    const mimeType = file.mimetype || 'video/mp4';
    let sectionId: string | null;
    try {
      await this.coursesService.assertCanManageCourse(dto.courseId, user);
      sectionId = await this.resolveSectionId(dto.sectionId, dto.courseId);
      // On `gcs` multer only wrote a scratch copy: move it into the bucket.
      await this.storage.persistUpload(storageKey, file.path, mimeType);
    } catch (err) {
      await this.storage.deleteFile(storageKey);
      throw err;
    }

    return this.insertUploadedLesson(dto, sectionId, {
      storageKey,
      originalName: multerFileName(file),
      mimeType,
      size: file.size,
    });
  }

  private async insertUploadedLesson(dto: UploadVideoLessonDto, sectionId: string | null, video: StoredVideo) {
    const id = generateId('lesson');
    const sortOrder = dto.sortOrder ?? (await this.getNextSortOrder(dto.courseId));

    return this.db.queryOne(
      `INSERT INTO lessons
         (id, course_id, title, description, duration, sort_order, is_free, source_type, storage_key, original_file_name, mime_type, file_size, section_id, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        video.storageKey,
        video.originalName,
        video.mimeType,
        video.size,
        sectionId,
        this.minutesFor(dto),
      ],
    );
  }

  /**
   * Step 1 of a video upload. Checks the teacher and the file, then on `gcs`
   * returns a short-lived signed PUT URL for a server-made key plus a token
   * for the confirm call. On `local` it returns `{ direct: false }` and the
   * client sends the file as multipart, as before.
   */
  async requestVideoUpload(dto: RequestVideoUploadDto, user: AuthUser) {
    await this.coursesService.assertCanManageCourse(dto.courseId, user);
    const contentType = videoContentType(dto.fileName);
    if (!contentType || !isAcceptableVideoMime(dto.contentType)) {
      throw new BadRequestException(VIDEO_FORMATS_MESSAGE);
    }
    if (dto.fileSize > maxVideoBytes()) {
      throw new BadRequestException(`Tệp video vượt quá ${maxVideoBytes() / 1024 / 1024} MB.`);
    }
    if (!this.storage.usesSignedUrls) {
      return { direct: false as const };
    }

    const storageKey = this.storage.generateStorageKey('videos', dto.fileName);
    const signed = await this.storage.getSignedUploadUrl(storageKey, contentType);
    return {
      direct: true as const,
      uploadUrl: signed.url,
      expiresAt: signed.expiresAt,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      storageKey,
      uploadToken: signUploadToken({ userId: user.id, courseId: dto.courseId, storageKey }, this.uploadSecret()),
    };
  }

  /**
   * Checks a directly uploaded object: a valid token for this teacher and
   * course, the object exists, its size is allowed and no lesson uses it yet.
   * A bad object is deleted; a key without a valid token is left alone.
   */
  private async checkDirectUpload(
    courseId: string,
    dto: { storageKey: string; uploadToken: string; originalFileName: string },
    user: AuthUser,
  ): Promise<StoredVideo> {
    const claims = { userId: user.id, courseId, storageKey: dto.storageKey };
    if (!isVideoStorageKey(dto.storageKey) || !verifyUploadToken(dto.uploadToken, claims, this.uploadSecret())) {
      throw new BadRequestException('Phiên tải video không hợp lệ hoặc đã hết hạn. Vui lòng tải lại.');
    }

    try {
      await this.coursesService.assertCanManageCourse(courseId, user);
    } catch (err) {
      await this.storage.deleteFile(dto.storageKey);
      throw err;
    }

    const used = await this.db.queryOne('SELECT id FROM lessons WHERE storage_key = $1', [dto.storageKey]);
    if (used) {
      throw new BadRequestException('Video này đã được gắn vào một bài giảng.');
    }

    const info = await this.storage.getObjectInfo(dto.storageKey);
    if (!info) {
      throw new BadRequestException('Chưa nhận được tệp video. Vui lòng tải lên lại.');
    }
    if (info.size <= 0 || info.size > maxVideoBytes()) {
      await this.storage.deleteFile(dto.storageKey);
      throw new BadRequestException(`Tệp video phải lớn hơn 0 và không quá ${maxVideoBytes() / 1024 / 1024} MB.`);
    }

    return {
      storageKey: dto.storageKey,
      originalName: dto.originalFileName.trim().slice(0, 255) || dto.storageKey.split('/').pop()!,
      mimeType: info.contentType || videoContentType(dto.storageKey) || 'video/mp4',
      size: info.size,
    };
  }

  /** Step 2 of a direct upload: the object is in the bucket, create the lesson. */
  async confirmUploadedLesson(dto: ConfirmVideoUploadDto, user: AuthUser) {
    const video = await this.checkDirectUpload(dto.courseId, dto, user);
    let sectionId: string | null;
    try {
      sectionId = await this.resolveSectionId(dto.sectionId, dto.courseId);
    } catch (err) {
      await this.storage.deleteFile(video.storageKey);
      throw err;
    }
    return this.insertUploadedLesson(dto, sectionId, video);
  }

  /** Step 2 of a direct upload that replaces the video of an existing lesson. */
  async confirmReplacedVideo(id: string, dto: ConfirmVideoReplaceDto, user: AuthUser) {
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!lesson) {
      throw new NotFoundException('Không tìm thấy bài giảng.');
    }
    const video = await this.checkDirectUpload(lesson.course_id, dto, user);
    return this.applyReplacement(lesson, dto, video);
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
    if (dto.durationMinutes !== undefined || dto.duration !== undefined) {
      sets.push(`duration_minutes = $${idx++}`);
      params.push(this.minutesFor(dto));
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

    const storageKey = `videos/${file.filename}`;
    const mimeType = file.mimetype || 'video/mp4';
    const lesson = await this.db.queryOne('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!lesson) {
      await this.storage.deleteFile(storageKey);
      throw new NotFoundException('Không tìm thấy bài giảng.');
    }

    try {
      await this.coursesService.assertCanManageCourse(lesson.course_id, user);
      await this.storage.persistUpload(storageKey, file.path, mimeType);
    } catch (err) {
      await this.storage.deleteFile(storageKey);
      throw err;
    }

    return this.applyReplacement(lesson, dto, {
      storageKey,
      originalName: multerFileName(file),
      mimeType,
      size: file.size,
    });
  }

  /** Points the lesson at its new video, then removes the old file. */
  private async applyReplacement(lesson: any, dto: UpdateLessonDto, video: StoredVideo) {
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
        video.storageKey,
        video.originalName,
        video.mimeType,
        video.size,
        lesson.id,
      ],
    );

    if (lesson.storage_key && lesson.storage_key !== video.storageKey) {
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

    const contentType = lesson.mime_type || 'video/mp4';

    // Bucket: hand the browser a short-lived signed URL instead of proxying bytes.
    // The <video> element follows the redirect; on expiry the player asks this route again.
    if (this.storage.usesSignedUrls) {
      const signed = await this.storage.getSignedReadUrl(lesson.storage_key, { contentType });
      res.setHeader('Cache-Control', 'private, no-store');
      res.redirect(302, signed.url);
      return;
    }

    const fileSize = await this.storage.getFileSize(lesson.storage_key);
    const range = req.headers.range;

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

      this.storage.pipeTo(res, lesson.storage_key, { start, end });
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      });

      this.storage.pipeTo(res, lesson.storage_key);
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
    await this.storage.saveBuffer(key, file.buffer, 'text/vtt; charset=utf-8');
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
      !(await this.storage.fileExists(lesson.subtitle_key))
    ) {
      throw new NotFoundException('Bài giảng này chưa có phụ đề.');
    }
    if (!lesson.is_free && !(await this.coursesService.checkUserCourseAccess(lesson.course_id, user))) {
      throw new ForbiddenException('Bạn chưa được cấp quyền xem video của khóa học này.');
    }
    res.writeHead(200, {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Content-Length': await this.storage.getFileSize(lesson.subtitle_key),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    this.storage.pipeTo(res, lesson.subtitle_key);
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
