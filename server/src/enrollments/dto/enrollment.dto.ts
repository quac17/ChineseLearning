import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetCourseAccessDto {
  @IsString()
  courseId: string;

  @IsString()
  studentId: string;

  @IsBoolean()
  canView: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
