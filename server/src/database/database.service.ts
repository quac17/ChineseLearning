import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

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
        user: configService.get<string>('POSTGRES_USER') || 'vankinh',
        password: configService.get<string>('POSTGRES_PASSWORD') || 'vankinh_secret',
        database: configService.get<string>('POSTGRES_DB') || 'vankinh_db',
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

  /**
   * Runs `work` on one dedicated connection inside BEGIN/COMMIT, rolling back
   * if it throws. Never issue BEGIN on the shared pool: each query may land
   * on a different connection.
   */
  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
