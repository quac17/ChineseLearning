import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { QuizMode, QuizQuestionKind } from '../../common/types/domain.types';

const QUIZ_KINDS: QuizQuestionKind[] = ['choice', 'listen', 'order', 'fill', 'match'];

export class QuizQuestionItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsIn(QUIZ_KINDS, { message: 'Loại câu hỏi không hợp lệ' })
  kind: QuizQuestionKind;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vocabularyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  prompt?: string | null;

  @IsOptional()
  @IsBoolean()
  audioOverride?: boolean;

  @IsObject({ message: 'Dữ liệu câu hỏi không hợp lệ' })
  payload: Record<string, any>;
}

export class SaveLessonQuizDto {
  @IsEnum(QuizMode, { message: 'Chế độ tạo quiz phải là AUTO hoặc MANUAL' })
  quizMode: QuizMode;

  @IsArray()
  @ArrayMaxSize(100, { message: 'Mỗi bài tối đa 100 câu hỏi quiz thủ công' })
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionItemDto)
  questions: QuizQuestionItemDto[];
}
