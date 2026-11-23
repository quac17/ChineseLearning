import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ProgramModule } from '../../common/types/domain.types';
import { CourseLevel } from '../course-meta';

const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/** Fields the teacher "Thông tin" tab edits (#28). null clears a field. */
class CourseInfoFields {
  @IsOptional()
  @Transform(blankToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120, { message: 'Mô tả ngắn tối đa 120 ký tự' })
  subtitle?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(Object.values(CourseLevel), { message: 'Cấp độ phải là BEGINNER, INTERMEDIATE hoặc ADVANCED' })
  level?: CourseLevel | null;

  /** "Bạn sẽ học được", one line each. Blank lines are dropped. */
  @IsOptional()
  @IsArray({ message: 'Danh sách "Bạn sẽ học được" không hợp lệ' })
  @ArrayMaxSize(12, { message: 'Tối đa 12 ý "Bạn sẽ học được"' })
  @IsString({ each: true })
  @MaxLength(160, { each: true, message: 'Mỗi ý "Bạn sẽ học được" tối đa 160 ký tự' })
  outcomes?: string[];
}

export class CreateCourseDto extends CourseInfoFields {
  @IsString()
  @MinLength(2, { message: 'Tên khóa học tối thiểu 2 ký tự' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString({ message: 'Chương trình học không hợp lệ' })
  @MinLength(1, { message: 'Vui lòng chọn chương trình học' })
  @MaxLength(20, { message: 'Mã chương trình tối đa 20 ký tự' })
  module: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCourseDto extends CourseInfoFields {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tên khóa học tối thiểu 2 ký tự' })
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString({ message: 'Chương trình học không hợp lệ' })
  @MinLength(1, { message: 'Vui lòng chọn chương trình học' })
  @MaxLength(20, { message: 'Mã chương trình tối đa 20 ký tự' })
  module?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/** Admin only. null = paid course not on sale yet (no buy button). */
export class SetCoursePriceDto {
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: 'Giá phải là số nguyên (đồng)' })
  @Min(1000, { message: 'Giá tối thiểu 1.000 ₫' })
  @Max(100_000_000, { message: 'Giá tối đa 100.000.000 ₫' })
  priceVnd: number | null;
}

/**
 * Admin only. Both null = no rating (the block is hidden). A value is only
 * accepted with its real source; the pairing is checked in the service.
 */
export class SetCourseRatingDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Điểm đánh giá từ 1 đến 5, tối đa một chữ số thập phân.' })
  ratingValue?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'Nguồn đánh giá không hợp lệ' })
  ratingSource?: string | null;
}

/** Admin only. Learners of the offline classes, shown apart from online accounts; null = none. */
export class SetOfflineLearnersDto {
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: 'Số học viên offline phải là số nguyên' })
  @Min(1, { message: 'Số học viên offline tối thiểu 1 (để trống nếu không có)' })
  @Max(1_000_000, { message: 'Số học viên offline quá lớn' })
  offlineLearnerCount: number | null;
}

export class ReorderCoursesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds: string[];
}
