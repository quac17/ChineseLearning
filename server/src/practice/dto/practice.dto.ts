import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { ReviewOutcome } from '../leitner';

export class ReviewResultDto {
  @IsString()
  vocabularyId: string;

  @IsIn(['remembered', 'forgot', 'quiz_correct', 'quiz_wrong'], { message: 'Kết quả ôn tập không hợp lệ' })
  outcome: ReviewOutcome;
}

export class SaveReviewsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReviewResultDto)
  results: ReviewResultDto[];
}
