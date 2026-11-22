import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BODY_MAX, normalizeBody } from '../notes-qa.rules';

const trim = ({ value }: { value: unknown }) => normalizeBody(value);

export class CreateNoteDto {
  @IsString()
  @MinLength(1, { message: 'Thiếu bài học' })
  lessonId: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Ghi chú đang trống' })
  @MaxLength(BODY_MAX, { message: `Ghi chú tối đa ${BODY_MAX} ký tự` })
  body: string;

  /** Second of the video the note refers to (uploaded videos only). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mốc thời gian không hợp lệ' })
  @Min(0, { message: 'Mốc thời gian không hợp lệ' })
  @Max(86_400, { message: 'Mốc thời gian không hợp lệ' })
  videoSeconds?: number;
}

export class UpdateNoteDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Ghi chú đang trống' })
  @MaxLength(BODY_MAX, { message: `Ghi chú tối đa ${BODY_MAX} ký tự` })
  body: string;
}

export class AskQuestionDto {
  @IsString()
  @MinLength(1, { message: 'Thiếu bài học' })
  lessonId: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Câu hỏi đang trống' })
  @MaxLength(BODY_MAX, { message: `Câu hỏi tối đa ${BODY_MAX} ký tự` })
  body: string;
}

export class AnswerDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Câu trả lời đang trống' })
  @MaxLength(BODY_MAX, { message: `Câu trả lời tối đa ${BODY_MAX} ký tự` })
  body: string;
}
