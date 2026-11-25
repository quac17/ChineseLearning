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
import { audioUploadInterceptorOptions } from './audio-upload';
import { SaveVocabularyDto } from './dto/vocabulary.dto';
import { VocabularyService } from './vocabulary.service';

@Controller('lessons/:lessonId/vocabulary')
export class VocabularyController {
  constructor(private readonly vocabulary: VocabularyService) {}

  /** Public for free lessons; paid lessons need access (403 otherwise). */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Param('lessonId') lessonId: string, @CurrentUser() user: AuthUser | null) {
    return this.vocabulary.listForViewer(lessonId, user);
  }

  /** Replaces the whole list. Owner teacher or admin (teacher "Từ vựng" tab). */
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  save(@Param('lessonId') lessonId: string, @Body() dto: SaveVocabularyDto, @CurrentUser() user: AuthUser) {
    return this.vocabulary.save(lessonId, dto, user);
  }

  /** Uploads/replaces custom override audio for one vocabulary word. */
  @Post(':vocabId/audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', audioUploadInterceptorOptions))
  uploadAudio(
    @Param('lessonId') lessonId: string,
    @Param('vocabId') vocabId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vocabulary.uploadAudio(lessonId, vocabId, file, user);
  }

  /** Deletes custom override audio for one vocabulary word (falls back to built-in TTS). */
  @Delete(':vocabId/audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  removeAudio(
    @Param('lessonId') lessonId: string,
    @Param('vocabId') vocabId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vocabulary.removeAudio(lessonId, vocabId, user);
  }

  /** Access-checked custom audio stream (or GCS signed URL redirect). */
  @Get(':vocabId/audio')
  @UseGuards(OptionalJwtAuthGuard)
  serveAudio(
    @Param('lessonId') lessonId: string,
    @Param('vocabId') vocabId: string,
    @CurrentUser() user: AuthUser | null,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.vocabulary.serveAudio(lessonId, vocabId, user, req, res);
  }
}
