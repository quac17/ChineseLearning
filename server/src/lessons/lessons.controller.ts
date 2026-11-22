import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';
import { LessonsService } from './lessons.service';
import {
  CreateYoutubeLessonDto,
  ReorderLessonsDto,
  UpdateLessonDto,
  UploadVideoLessonDto,
} from './dto/lesson.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/types/domain.types';
import { isAllowedSubtitleFile, subtitleMaxBytes } from './subtitle';

const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.mkv']);

function getVideoUploadDir() {
  const dir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'videos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const videoUploadInterceptorOptions = {
  storage: diskStorage({
    destination: (_req: any, _file: any, cb: any) => cb(null, getVideoUploadDir()),
    filename: (_req: any, file: any, cb: any) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, name);
    },
  }),
  limits: {
    fileSize: (Number(process.env.MAX_VIDEO_SIZE_MB) || 500) * 1024 * 1024,
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
      return cb(
        new BadRequestException(
          'Chỉ hỗ trợ tệp video định dạng .mp4, .webm, .mov, .m4v, .ogg, .mkv',
        ),
        false,
      );
    }
    cb(null, true);
  },
};

/** WebVTT files are small: kept in memory, checked, then saved under a server-made key. */
const subtitleUploadInterceptorOptions = {
  storage: memoryStorage(),
  limits: { fileSize: subtitleMaxBytes() },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!isAllowedSubtitleFile(file.originalname, file.mimetype)) {
      return cb(new BadRequestException('Chỉ hỗ trợ tệp phụ đề WebVTT (.vtt).'), false);
    }
    cb(null, true);
  },
};

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post('youtube')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  createYoutube(
    @Body() dto: CreateYoutubeLessonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.createYoutubeLesson(dto, user);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', videoUploadInterceptorOptions))
  uploadVideo(
    @Body() dto: UploadVideoLessonDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.createUploadedLesson(dto, file, user);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  reorder(@Body() dto: ReorderLessonsDto, @CurrentUser() user: AuthUser) {
    return this.lessonsService.reorder(dto.courseId, dto.orderedIds, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.updateLesson(id, dto, user);
  }

  @Patch(':id/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', videoUploadInterceptorOptions))
  replaceVideo(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.replaceVideoFile(id, dto, file, user);
  }

  @Get(':id/stream')
  @UseGuards(OptionalJwtAuthGuard)
  stream(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | null,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.lessonsService.streamVideo(id, user, req, res);
  }

  /** Pinyin subtitles for an uploaded video (YouTube lessons use YouTube's own). */
  @Post(':id/subtitle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', subtitleUploadInterceptorOptions))
  uploadSubtitle(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.saveSubtitle(id, file, user);
  }

  @Delete(':id/subtitle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  removeSubtitle(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lessonsService.removeSubtitle(id, user);
  }

  /** Same access rule as the video stream: free lesson, or access to the course. */
  @Get(':id/subtitle')
  @UseGuards(OptionalJwtAuthGuard)
  subtitle(@Param('id') id: string, @CurrentUser() user: AuthUser | null, @Res() res: Response) {
    return this.lessonsService.serveSubtitle(id, user, res);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lessonsService.remove(id, user);
  }
}
