import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (connectionString) {
      this.pool = new Pool({ connectionString });
    } else {
      this.pool = new Pool({
        host: configService.get<string>('POSTGRES_HOST') || 'localhost',
        port: Number(configService.get<string>('POSTGRES_PORT')) || 5433,
        user: configService.get<string>('POSTGRES_USER') || 'chinese_learner',
        password: configService.get<string>('POSTGRES_PASSWORD') || 'chinese_learner_secret',
        database: configService.get<string>('POSTGRES_DB') || 'chinese_learner_db',
      });
    }
  }

  async onModuleInit() {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  query<T extends QueryResultRow = any>(
    sql: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async queryOne<T extends QueryResultRow = any>(
    sql: string,
    params?: any[],
  ): Promise<T | null> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows[0] ?? null;
  }

  async queryAll<T extends QueryResultRow = any>(
    sql: string,
    params?: any[],
  ): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows;
  }
}
