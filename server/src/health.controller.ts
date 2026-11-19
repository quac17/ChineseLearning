import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check() {
    await this.db.query('SELECT 1');
    return {
      status: 'ok',
      service: 'vankinh-server',
      database: 'postgresql-raw-sql',
      timestamp: new Date().toISOString(),
    };
  }
}
