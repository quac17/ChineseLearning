import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { Response } from 'express';
import { StorageService } from '../common/storage/storage.service';
import { Role } from '../common/types/domain.types';
import { CoursesService } from './courses.service';
import {
  CreateCourseDto,
  ReorderCoursesDto,
  SetCoursePriceDto,
  SetCourseRatingDto,
  SetOfflineLearnersDto,
  UpdateCourseDto,
} from './dto/course.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

const ALLOWED_COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_COVER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Covers are small: kept in memory, checked by their bytes, then written under a server key. */
const coverUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_COVER_SIZE_MB) || 2) * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_COVER_EXTENSIONS.has(ext) || !ALLOWED_COVER_MIME.has(file.mimetype)) {
      return cb(new BadRequestException('Ảnh bìa phải là tệp JPG, PNG hoặc WebP.'), false);
    }
    cb(null, true);
  },
};

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query('module') moduleFilter: string | undefined,
    @Query('q') search: string | undefined,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.coursesService.findAll(moduleFilter, search, user);
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  findManageable(@CurrentUser() user: AuthUser) {
    return this.coursesService.findManageable(user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser | null) {
    return this.coursesService.findOne(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.create(dto, user);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  reorder(@Body() dto: ReorderCoursesDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.reorder(dto.orderedIds, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.update(id, dto, user);
  }

  /** Prices are set by admins only; teachers can read them but not change them. */
  @Patch(':id/price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  setPrice(@Param('id') id: string, @Body() dto: SetCoursePriceDto) {
    return this.coursesService.setPrice(id, dto.priceVnd);
  }

  /** Owner teacher or admin. Multipart field `file`: .jpg/.png/.webp, at most MAX_COVER_SIZE_MB (2). */
  @Post(':id/cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', coverUploadOptions))
  uploadCover(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    return this.coursesService.setCover(id, file, user);
  }

  @Delete(':id/cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  removeCover(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.coursesService.removeCover(id, user);
  }

  /**
   * Public on purpose: a cover is marketing shown on cards and the catalog,
   * not paid content. Only the stored image is served, never a lesson file.
   */
  @Get(':id/cover')
  async cover(@Param('id') id: string, @Res() res: Response) {
    const { key, contentType } = await this.coursesService.getCover(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    this.storage.createReadStream(key).pipe(res);
  }

  /** Admins only: a rating needs its real source (DECISIONS.md); both null hides it. */
  @Patch(':id/rating')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  setRating(@Param('id') id: string, @Body() dto: SetCourseRatingDto) {
    return this.coursesService.setRating(id, dto.ratingValue, dto.ratingSource);
  }

  /** Admins only: offline-class learners, shown apart from online accounts. */
  @Patch(':id/offline-learners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  setOfflineLearners(@Param('id') id: string, @Body() dto: SetOfflineLearnersDto) {
    return this.coursesService.setOfflineLearners(id, dto.offlineLearnerCount);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.coursesService.remove(id, user);
  }
}
