import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { SaveReviewsDto } from './dto/practice.dto';
import { PracticeService } from './practice.service';

/** Flashcards, quizzes and writing read words here; results feed the Leitner boxes. */
@Controller('practice')
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  @Get('decks')
  @UseGuards(OptionalJwtAuthGuard)
  decks(@CurrentUser() user: AuthUser | null) {
    return this.practice.decks(user);
  }

  /** ?lessonId=… (anyone who may watch the lesson) or ?due=true (logged in). */
  @Get('words')
  @UseGuards(OptionalJwtAuthGuard)
  words(
    @CurrentUser() user: AuthUser | null,
    @Query('lessonId') lessonId?: string,
    @Query('due') due?: string,
  ) {
    return this.practice.words(user, { lessonId, due: due === 'true' || due === '1' });
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  saveReviews(@Body() dto: SaveReviewsDto, @CurrentUser() user: AuthUser) {
    return this.practice.saveReviews(user, dto);
  }
}
