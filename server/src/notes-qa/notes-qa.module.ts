import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { NotesController, QuestionsController } from './notes-qa.controller';
import { NotesQaService } from './notes-qa.service';

/** Lesson notes (private) and lesson Q&A (course-wide) in the player. */
@Module({
  imports: [CoursesModule],
  controllers: [NotesController, QuestionsController],
  providers: [NotesQaService],
})
export class NotesQaModule {}
