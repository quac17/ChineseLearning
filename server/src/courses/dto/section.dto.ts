import { ArrayNotEmpty, IsArray, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SaveSectionDto {
  @Transform(trim)
  @IsString({ message: 'Vui lòng nhập tên phần' })
  @MinLength(2, { message: 'Tên phần tối thiểu 2 ký tự' })
  @MaxLength(255, { message: 'Tên phần tối đa 255 ký tự' })
  title: string;
}

export class ReorderSectionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds: string[];
}
