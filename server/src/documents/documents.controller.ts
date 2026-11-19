import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import {
  ReorderDocumentsDto,
  UpdateDocumentDto,
  UploadDocumentDto,
} from './dto/document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/types/domain.types';

const ALLOWED_DOC_EXTENSIONS = new Set(['.doc', '.docx', '.ppt', '.pptx']);

function getDocUploadDir() {
  const dir = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    'documents',
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, getDocUploadDir()),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
          cb(null, name);
        },
      }),
      limits: {
        fileSize: (Number(process.env.MAX_DOC_SIZE_MB) || 50) * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_DOC_EXTENSIONS.has(ext)) {
          return cb(
            new BadRequestException(
              'Chỉ chấp nhận tài liệu định dạng Word (.doc, .docx) hoặc PowerPoint (.ppt, .pptx)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.create(dto, file, user);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  reorder(@Body() dto: ReorderDocumentsDto, @CurrentUser() user: AuthUser) {
    return this.documentsService.reorder(dto.courseId, dto.orderedIds, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.update(id, dto, user);
  }

  @Get(':id/download')
  @UseGuards(OptionalJwtAuthGuard)
  download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | null,
    @Res() res: Response,
  ) {
    return this.documentsService.download(id, user, res);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.remove(id, user);
  }
}
