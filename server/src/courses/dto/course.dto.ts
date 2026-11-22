import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ProgramModule } from '../../common/types/domain.types';

export class CreateCourseDto {
  @IsString()
  @MinLength(2, { message: 'Tên khóa học tối thiểu 2 ký tự' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProgramModule, { message: 'Chương trình phải thuộc easy, yct, hsk hoặc talk' })
  module: ProgramModule;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tên khóa học tối thiểu 2 ký tự' })
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProgramModule, { message: 'Chương trình phải thuộc easy, yct, hsk hoặc talk' })
  module?: ProgramModule;

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

export class ReorderCoursesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds: string[];
}
