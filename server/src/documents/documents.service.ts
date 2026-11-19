import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { CoursesService } from '../courses/courses.service';
import { StorageService } from '../common/storage/storage.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { generateId } from '../common/types/domain.types';
import { UpdateDocumentDto, UploadDocumentDto } from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly coursesService: CoursesService,
    private readonly storage: StorageService,
  ) {}

  async create(
    dto: UploadDocumentDto,
    file: Express.Multer.File,
    user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Vui lòng chọn tệp tài liệu định dạng .doc, .docx, .ppt hoặc .pptx',
      );
    }

    try {
      await this.coursesService.assertCanManageCourse(dto.courseId, user);
    } catch (err) {
      await this.storage.deleteFile(`documents/${file.filename}`);
      throw err;
    }

    const id = generateId('doc');
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const storageKey = `documents/${file.filename}`;
    const originalFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const maxRow = await this.db.queryOne(
      'SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM course_documents WHERE course_id = $1',
      [dto.courseId],
    );
    const nextOrder = (maxRow?.max_order ?? -1) + 1;

    return this.db.queryOne(
      `INSERT INTO course_documents
         (id, course_id, title, description, original_file_name, storage_key, file_type, mime_type, file_size, sort_order, is_free)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        dto.courseId,
        dto.title.trim(),
        dto.description?.trim() || null,
        originalFileName,
        storageKey,
        ext,
        file.mimetype || 'application/octet-stream',
        file.size,
        nextOrder,
        dto.isFree ?? false,
      ],
    );
  }

  async update(id: string, dto: UpdateDocumentDto, user: AuthUser) {
    const doc = await this.db.queryOne(
      'SELECT * FROM course_documents WHERE id = $1',
      [id],
    );
    if (!doc) {
      throw new NotFoundException('Không tìm thấy tài liệu.');
    }
    await this.coursesService.assertCanManageCourse(doc.course_id, user);

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
    if (dto.isFree !== undefined) {
      sets.push(`is_free = $${idx++}`);
      params.push(dto.isFree);
    }

    params.push(id);
    return this.db.queryOne(
      `UPDATE course_documents SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
  }

  async reorder(courseId: string, orderedIds: string[], user: AuthUser) {
    await this.coursesService.assertCanManageCourse(courseId, user);
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.query(
        'UPDATE course_documents SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND course_id = $3',
        [i, orderedIds[i], courseId],
      );
    }
    return { reordered: true, count: orderedIds.length };
  }

  async download(docId: string, user: AuthUser | null, res: Response) {
    const doc = await this.db.queryOne(
      'SELECT * FROM course_documents WHERE id = $1',
      [docId],
    );

    if (!doc) {
      throw new NotFoundException('Không tìm thấy tài liệu.');
    }

    if (!doc.is_free) {
      const hasAccess = await this.coursesService.checkUserCourseAccess(
        doc.course_id,
        user,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'Bạn chưa được cấp quyền tải tài liệu của khóa học này.',
        );
      }
    }

    const stat = this.storage.getFileStat(doc.storage_key);
    const encodedName = encodeURIComponent(doc.original_file_name);
    const asciiFallback = String(doc.original_file_name).replace(/[^\x20-\x7E]/g, '_');

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`,
    );

    this.storage.createReadStream(doc.storage_key).pipe(res);
  }

  async remove(id: string, user: AuthUser) {
    const doc = await this.db.queryOne(
      'SELECT * FROM course_documents WHERE id = $1',
      [id],
    );
    if (!doc) {
      throw new NotFoundException('Không tìm thấy tài liệu.');
    }

    await this.coursesService.assertCanManageCourse(doc.course_id, user);
    await this.storage.deleteFile(doc.storage_key);
    await this.db.query('DELETE FROM course_documents WHERE id = $1', [id]);
    return { deleted: true, id };
  }
}
