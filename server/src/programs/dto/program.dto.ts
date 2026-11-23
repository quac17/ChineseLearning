import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trimValue = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

export class CreateProgramDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: 'Mã chương trình không hợp lệ' })
  @Matches(/^[a-z0-9_-]{2,20}$/, {
    message: 'Mã chương trình gồm 2–20 ký tự chữ thường, số, dấu gạch ngang (-) hoặc gạch dưới (_)',
  })
  code: string;

  @Transform(trimValue)
  @IsString({ message: 'Tên chương trình không được để trống' })
  @MinLength(1, { message: 'Tên chương trình không được để trống' })
  @MaxLength(100, { message: 'Tên chương trình tối đa 100 ký tự' })
  name: string;

  @Transform(trimValue)
  @IsString({ message: 'Chữ Hán đại diện không được để trống' })
  @MinLength(1, { message: 'Chữ Hán đại diện không được để trống' })
  @MaxLength(20, { message: 'Chữ Hán đại diện tối đa 20 ký tự' })
  han: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(255, { message: 'Mô tả ngắn tối đa 255 ký tự' })
  cardDesc?: string | null;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  description?: string | null;

  @Transform(trimValue)
  @IsString({ message: 'Màu chính không hợp lệ' })
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'Màu chính phải là mã màu hex (ví dụ #0f7c90)' })
  color1: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString({ message: 'Màu phụ không hợp lệ' })
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'Màu phụ phải là mã màu hex (ví dụ #b58a2e)' })
  color2?: string;

  @IsOptional()
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị tối thiểu là 0' })
  sortOrder?: number;
}

export class UpdateProgramDto {
  @IsOptional()
  @Transform(trimValue)
  @IsString({ message: 'Tên chương trình không hợp lệ' })
  @MinLength(1, { message: 'Tên chương trình không được để trống' })
  @MaxLength(100, { message: 'Tên chương trình tối đa 100 ký tự' })
  name?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString({ message: 'Chữ Hán đại diện không hợp lệ' })
  @MinLength(1, { message: 'Chữ Hán đại diện không được để trống' })
  @MaxLength(20, { message: 'Chữ Hán đại diện tối đa 20 ký tự' })
  han?: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(255, { message: 'Mô tả ngắn tối đa 255 ký tự' })
  cardDesc?: string | null;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(trimValue)
  @IsString({ message: 'Màu chính không hợp lệ' })
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'Màu chính phải là mã màu hex (ví dụ #0f7c90)' })
  color1?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString({ message: 'Màu phụ không hợp lệ' })
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'Màu phụ phải là mã màu hex (ví dụ #b58a2e)' })
  color2?: string;

  @IsOptional()
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên' })
  @Min(0, { message: 'Thứ tự hiển thị tối thiểu là 0' })
  sortOrder?: number;
}
