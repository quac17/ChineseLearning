import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateYoutubeLessonDto {
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

export class UploadVideoLessonDto {
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

export class UpdateLessonDto {
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
