import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateLessonProgressDto } from './dto/progress.dto';
import { ProgressService } from './progress.service';

/** Each learner only ever reads and writes their own progress. */
@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.progress.mine(user);
  }

  @Get('courses/:courseId')
  forCourse(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser) {
    return this.progress.forCourse(user, courseId);
  }

  @Put('lessons/:lessonId')
  updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonProgressDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.progress.updateLesson(user, lessonId, dto);
  }
}
