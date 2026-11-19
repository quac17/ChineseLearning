import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '../common/types/domain.types';
import { EnrollmentsService } from './enrollments.service';
import { SetCourseAccessDto } from './dto/enrollment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('my')
  getMyEnrollments(@CurrentUser() user: AuthUser) {
    return this.enrollmentsService.getMyEnrollments(user);
  }

  @Get('course/:courseId')
  @Roles(Role.ADMIN, Role.TEACHER)
  getCourseGrantedStudents(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.getCourseGrantedStudents(courseId, user);
  }

  @Get('course/:courseId/search-students')
  @Roles(Role.ADMIN, Role.TEACHER)
  searchStudentsForCourse(
    @Param('courseId') courseId: string,
    @Query('q') q: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.searchStudentsForCourse(courseId, q, user);
  }

  @Post('access')
  @Roles(Role.ADMIN, Role.TEACHER)
  setCourseAccess(
    @Body() dto: SetCourseAccessDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.setCourseAccess(dto, user);
  }
}
