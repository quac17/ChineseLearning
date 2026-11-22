import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { HIDE_REASON_MAX, HIDE_REASON_MIN, REVIEW_TEXT_MAX, normalizeText } from '../reviews.rules';

const text = ({ value }: { value: unknown }) => normalizeText(value);

export class SaveReviewDto {
  @Type(() => Number)
  @IsInt({ message: 'Chọn từ 1 đến 5 sao' })
  @Min(1, { message: 'Chọn từ 1 đến 5 sao' })
  @Max(5, { message: 'Chọn từ 1 đến 5 sao' })
  stars: number;

  /** Optional; blank is stored as no comment. */
  @IsOptional()
  @Transform(text)
  @IsString({ message: 'Nhận xét không hợp lệ' })
  @MaxLength(REVIEW_TEXT_MAX, { message: `Nhận xét tối đa ${REVIEW_TEXT_MAX} ký tự` })
  comment?: string | null;
}

export class ReplyDto {
  @Transform(text)
  @IsString({ message: 'Câu trả lời đang trống' })
  @MinLength(1, { message: 'Câu trả lời đang trống' })
  @MaxLength(REVIEW_TEXT_MAX, { message: `Câu trả lời tối đa ${REVIEW_TEXT_MAX} ký tự` })
  body: string;
}

export class HideReviewDto {
  @IsBoolean({ message: 'Thiếu trạng thái ẩn/hiện' })
  hidden: boolean;

  /** Required when hiding; shown to the author and kept for the record. */
  @ValidateIf((o) => o.hidden === true)
  @Transform(text)
  @IsString({ message: `Ghi lý do ẩn (tối thiểu ${HIDE_REASON_MIN} ký tự)` })
  @MinLength(HIDE_REASON_MIN, { message: `Ghi lý do ẩn (tối thiểu ${HIDE_REASON_MIN} ký tự)` })
  @MaxLength(HIDE_REASON_MAX, { message: `Lý do tối đa ${HIDE_REASON_MAX} ký tự` })
  reason?: string;
}

export class ListReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang không hợp lệ' })
  @Min(1, { message: 'Trang không hợp lệ' })
  @Max(10_000, { message: 'Trang không hợp lệ' })
  page?: number;
}

export class AdminReviewsQueryDto extends ListReviewsQueryDto {
  @IsOptional()
  @IsIn(['all', 'visible', 'hidden'], { message: 'Bộ lọc không hợp lệ' })
  status?: 'all' | 'visible' | 'hidden';
}
