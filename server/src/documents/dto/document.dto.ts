import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadDocumentDto {
  @IsString()
  courseId: string;

  @IsString()
  @MinLength(2, { message: 'Tiêu đề tài liệu tối thiểu 2 ký tự' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFree?: boolean;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tiêu đề tài liệu tối thiểu 2 ký tự' })
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFree?: boolean;
}

export class ReorderDocumentsDto {
  @IsString()
  courseId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds: string[];
}
