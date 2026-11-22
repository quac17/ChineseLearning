import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutDto {
  @IsString({ message: 'Thiếu mã khoá học' })
  courseId: string;
}

export class AdminOrderActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}
