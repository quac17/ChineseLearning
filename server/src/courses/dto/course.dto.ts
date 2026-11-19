import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
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

export class ReorderCoursesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds: string[];
}
