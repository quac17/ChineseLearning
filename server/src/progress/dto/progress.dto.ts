import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateLessonProgressDto {
  /** Manual tick (true/false). Omit to only save the position. */
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  /** Where the learner stopped in an uploaded video, in whole seconds. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 3600)
  positionSeconds?: number;

  /** Video length reported by the player; lets the server apply the 90% rule. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 3600)
  durationSeconds?: number;
}
