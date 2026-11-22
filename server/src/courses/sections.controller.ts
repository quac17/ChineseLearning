import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/types/domain.types';
import { ReorderSectionsDto, SaveSectionDto } from './dto/section.dto';
import { SectionsService } from './sections.service';

/**
 * Sections of a course (teacher "Bài giảng" tab). Reading is part of
 * GET /courses/:id (`sections`); these routes are for the owner teacher or an
 * admin (ownership checked in the service). Lessons join a section through
 * PATCH /lessons/:id { sectionId }.
 */
@Controller('courses/:courseId/sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TEACHER)
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Post()
  create(@Param('courseId') courseId: string, @Body() dto: SaveSectionDto, @CurrentUser() user: AuthUser) {
    return this.sections.create(courseId, dto.title, user);
  }

  @Patch('reorder')
  reorder(@Param('courseId') courseId: string, @Body() dto: ReorderSectionsDto, @CurrentUser() user: AuthUser) {
    return this.sections.reorder(courseId, dto.orderedIds, user);
  }

  @Patch(':sectionId')
  rename(
    @Param('courseId') courseId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: SaveSectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sections.rename(courseId, sectionId, dto.title, user);
  }

  @Delete(':sectionId')
  remove(@Param('courseId') courseId: string, @Param('sectionId') sectionId: string, @CurrentUser() user: AuthUser) {
    return this.sections.remove(courseId, sectionId, user);
  }
}
