import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** "" (empty multipart field) means "no section". */
const toSectionId = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? null : typeof value === 'string' ? value.trim() : value;

/** "" / "null" (multipart) = clear; numeric strings become numbers. */
const toMinutes = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' || value === null ? null : typeof value === 'string' ? Number(value) : value;

/** Optional section ("Phần") of the same course; null = no section. */
class WithSection {
  @IsOptional()
  @Transform(toSectionId)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'Mã phần không hợp lệ' })
  sectionId?: string | null;

  /**
   * Length in whole minutes (drives totals and the catalog filter). When left
   * out, it is read from the free-text `duration` ("12 phút", "14:00").
   */
  @IsOptional()
  @Transform(toMinutes)
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: 'Thời lượng phải là số phút' })
  @Min(1, { message: 'Thời lượng tối thiểu 1 phút' })
  @Max(600, { message: 'Thời lượng tối đa 600 phút' })
  durationMinutes?: number | null;
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

/** Step 1 of a video upload: what the teacher is about to send. */
export class RequestVideoUploadDto {
  @IsString()
  courseId: string;

  @IsString({ message: 'Thiếu tên tệp video' })
  @MinLength(1, { message: 'Thiếu tên tệp video' })
  @MaxLength(255, { message: 'Tên tệp video tối đa 255 ký tự' })
  fileName: string;

  /** The browser's own type (`File.type`); may be empty. */
  @IsOptional()
  @IsString()
  contentType?: string;

  @Type(() => Number)
  @IsInt({ message: 'Dung lượng tệp không hợp lệ' })
  @Min(1, { message: 'Tệp video trống' })
  fileSize: number;
}

/** Step 2 for a new lesson: the lesson fields plus the object uploaded in step 1. */
export class ConfirmVideoUploadDto extends UploadVideoLessonDto {
  @IsString()
  storageKey: string;

  @IsString()
  uploadToken: string;

  @IsString()
  @MaxLength(255, { message: 'Tên tệp video tối đa 255 ký tự' })
  originalFileName: string;
}

/** Step 2 when replacing the video of an existing lesson. */
export class ConfirmVideoReplaceDto extends UpdateLessonDto {
  @IsString()
  storageKey: string;

  @IsString()
  uploadToken: string;

  @IsString()
  @MaxLength(255, { message: 'Tên tệp video tối đa 255 ký tự' })
  originalFileName: string;
}

export class ReorderLessonsDto {
  @IsString()
  courseId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds: string[];
}
