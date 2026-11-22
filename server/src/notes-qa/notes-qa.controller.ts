import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AnswerDto, AskQuestionDto, CreateNoteDto, UpdateNoteDto } from './dto/notes-qa.dto';
import { NotesQaService } from './notes-qa.service';

/** Private notes: each learner only reads and writes their own (lesson must be watchable). */
@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly service: NotesQaService) {}

  @Get('lessons/:lessonId')
  list(@Param('lessonId') lessonId: string, @CurrentUser() user: AuthUser) {
    return this.service.listNotes(user, lessonId);
  }

  @Post()
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: AuthUser) {
    return this.service.createNote(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto, @CurrentUser() user: AuthUser) {
    return this.service.updateNote(user, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.removeNote(user, id);
  }
}

/**
 * Lesson Q&A: anyone with access to the course reads and asks; answering is
 * checked per course in the service (its teacher or an admin), not by role alone.
 */
@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
  constructor(private readonly service: NotesQaService) {}

  @Get('lessons/:lessonId')
  list(@Param('lessonId') lessonId: string, @CurrentUser() user: AuthUser) {
    return this.service.listQuestions(user, lessonId);
  }

  @Post()
  ask(@Body() dto: AskQuestionDto, @CurrentUser() user: AuthUser) {
    return this.service.ask(user, dto);
  }

  @Delete('answers/:answerId')
  removeAnswer(@Param('answerId') answerId: string, @CurrentUser() user: AuthUser) {
    return this.service.removeAnswer(user, answerId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.removeQuestion(user, id);
  }

  @Post(':id/answers')
  answer(@Param('id') id: string, @Body() dto: AnswerDto, @CurrentUser() user: AuthUser) {
    return this.service.answer(user, id, dto);
  }
}
