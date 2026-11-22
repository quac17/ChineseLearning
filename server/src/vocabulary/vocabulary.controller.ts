import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/types/domain.types';
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
}
