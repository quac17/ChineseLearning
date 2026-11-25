import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/types/domain.types';
import { audioUploadInterceptorOptions } from '../vocabulary/audio-upload';
import { SaveLessonQuizDto } from './dto/lesson-quiz.dto';
import { LessonQuizService } from './lesson-quiz.service';

@Controller('lessons/:lessonId/quiz')
export class LessonQuizController {
  constructor(private readonly lessonQuiz: LessonQuizService) {}

  /** Teacher/admin reads quiz mode (AUTO | MANUAL) and manual questions for editing. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  get(@Param('lessonId') lessonId: string, @CurrentUser() user: AuthUser) {
    return this.lessonQuiz.getForTeacher(lessonId, user);
  }

  /** Saves quiz mode and manual questions for a lesson. Owner teacher or admin. */
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  save(@Param('lessonId') lessonId: string, @Body() dto: SaveLessonQuizDto, @CurrentUser() user: AuthUser) {
    return this.lessonQuiz.save(lessonId, dto, user);
  }

  /** Uploads/replaces custom override audio for one manual quiz question. */
  @Post(':questionId/audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', audioUploadInterceptorOptions))
  uploadAudio(
    @Param('lessonId') lessonId: string,
    @Param('questionId') questionId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonQuiz.uploadAudio(lessonId, questionId, file, user);
  }

  /** Deletes custom override audio for one manual quiz question. */
  @Delete(':questionId/audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  removeAudio(
    @Param('lessonId') lessonId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonQuiz.removeAudio(lessonId, questionId, user);
  }

  /** Access-checked custom audio stream (or GCS signed URL redirect) for learners. */
  @Get(':questionId/audio')
  @UseGuards(OptionalJwtAuthGuard)
  serveAudio(
    @Param('lessonId') lessonId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser | null,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.lessonQuiz.serveAudio(lessonId, questionId, user, req, res);
  }
}
