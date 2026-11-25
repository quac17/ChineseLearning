import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { LessonQuizController } from './lesson-quiz.controller';
import { LessonQuizService } from './lesson-quiz.service';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

@Module({
  imports: [CoursesModule],
  controllers: [PracticeController, LessonQuizController],
  providers: [PracticeService, LessonQuizService],
})
export class PracticeModule {}
