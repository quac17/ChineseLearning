import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** "" (empty multipart field) means "no section". */
const toSectionId = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? null : typeof value === 'string' ? value.trim() : value;

/** Optional section ("Phần") of the same course; null = no section. */
class WithSection {
  @IsOptional()
  @Transform(toSectionId)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'Mã phần không hợp lệ' })
  sectionId?: string | null;
}

export class CreateYoutubeLessonDto extends WithSection {
  @IsString()
  courseId: string;

  @IsString()
  @MinLength(2, { message: 'Tiêu đề bài giảng tối thiểu 2 ký tự' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFree?: boolean;

  @IsString({ message: 'Vui lòng nhập đường dẫn hoặc ID video YouTube' })
  youtubeUrl: string;
}

export class UploadVideoLessonDto extends WithSection {
  @IsString()
  courseId: string;

  @IsString()
  @MinLength(2, { message: 'Tiêu đề bài giảng tối thiểu 2 ký tự' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFree?: boolean;
}

export class UpdateLessonDto extends WithSection {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tiêu đề bài giảng tối thiểu 2 ký tự' })
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsString()
  youtubeUrl?: string;
}

export class ReorderLessonsDto {
  @IsString()
  courseId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds: string[];
}
