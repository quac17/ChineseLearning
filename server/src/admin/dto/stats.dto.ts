import { IsIn, IsOptional } from 'class-validator';
import { STATS_PERIODS, StatsPeriod } from '../stats-period';

export class StatsQueryDto {
  @IsOptional()
  @IsIn(STATS_PERIODS, { message: 'Khoảng thời gian phải là 30d, month hoặc year' })
  period?: StatsPeriod;
}
