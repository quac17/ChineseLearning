import { Body, Controller, Delete, Get, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/types/domain.types';
import { AdminReviewsQueryDto, HideReviewDto, ListReviewsQueryDto, ReplyDto, SaveReviewDto } from './dto/reviews.dto';
import { ReviewsService } from './reviews.service';

/** Course reviews: public reading, the learner's own review, teacher replies. */
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /**
   * Deliberately public, like the course page: only visible reviews, the
   * reviewer's name shortened, no user ids.
   */
  @Get('courses/:courseId/reviews')
  list(@Param('courseId') courseId: string, @Query() query: ListReviewsQueryDto) {
    return this.reviews.listPublic(courseId, query.page);
  }

  /** Eligibility is checked per course in the service (STUDENT with open access to a paid course). */
  @Get('courses/:courseId/reviews/mine')
  @UseGuards(JwtAuthGuard)
  mine(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.reviews.mine(user, courseId);
  }

  @Put('courses/:courseId/reviews/mine')
  @UseGuards(JwtAuthGuard)
  save(@Param('courseId') courseId: string, @Body() dto: SaveReviewDto, @CurrentUser() user: AuthUser) {
    return this.reviews.saveMine(user, courseId, dto);
  }

  @Delete('courses/:courseId/reviews/mine')
  @UseGuards(JwtAuthGuard)
  remove(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.reviews.removeMine(user, courseId);
  }

  /** Ownership is checked with assertCanManageCourse in the service. */
  @Get('courses/:courseId/reviews/manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  manage(@Param('courseId') courseId: string, @Query() query: ListReviewsQueryDto, @CurrentUser() user: AuthUser) {
    return this.reviews.listForCourseManager(user, courseId, query.page);
  }

  /** The course's own teacher or an admin (checked per review in the service). */
  @Put('reviews/:id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  reply(@Param('id') id: string, @Body() dto: ReplyDto, @CurrentUser() user: AuthUser) {
    return this.reviews.reply(user, id, dto);
  }

  @Delete('reviews/:id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  removeReply(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reviews.removeReply(user, id);
  }
}

/** Moderation: admins only. */
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: AdminReviewsQueryDto) {
    return this.reviews.listForAdmin(query.status, query.page);
  }

  @Patch(':id/hidden')
  setHidden(@Param('id') id: string, @Body() dto: HideReviewDto, @CurrentUser() user: AuthUser) {
    return this.reviews.setHidden(user, id, dto);
  }
}
