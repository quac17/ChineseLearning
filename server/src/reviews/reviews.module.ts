import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { AdminReviewsController, ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/** Real course reviews from learners who bought the course (#41). */
@Module({
  imports: [CoursesModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
