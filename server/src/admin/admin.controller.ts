import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/types/domain.types';
import { StatsQueryDto } from './dto/stats.dto';
import { AdminService } from './admin.service';
import { parsePeriod } from './stats-period';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Figures for the admin stats page, revenue included: admins only. */
  @Get('stats')
  stats(@Query() query: StatsQueryDto) {
    return this.admin.stats(parsePeriod(query.period));
  }
}
