import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProgramDto, UpdateProgramDto } from './dto/program.dto';

export interface ProgramModuleItem {
  code: string;
  name: string;
  han: string;
  cardDesc: string | null;
  description: string | null;
  color1: string;
  color2: string;
  sortOrder: number;
  courseCount: number;
}

function mapProgram(row: any): ProgramModuleItem {
  return {
    code: row.code,
    name: row.name,
    han: row.han,
    cardDesc: row.card_desc ?? null,
    description: row.description ?? null,
    color1: row.color_1,
    color2: row.color_2,
    sortOrder: Number(row.sort_order ?? 0),
    courseCount: Number(row.course_count ?? 0),
  };
}

@Injectable()
export class ProgramsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<ProgramModuleItem[]> {
    const rows = await this.db.queryAll(
      `SELECT p.code, p.name, p.han, p.card_desc, p.description, p.color_1, p.color_2, p.sort_order,
              COUNT(c.id)::int AS course_count
       FROM program_modules p
       LEFT JOIN courses c ON c.module = p.code
       GROUP BY p.code
       ORDER BY p.sort_order ASC, p.code ASC`,
    );
    return rows.map(mapProgram);
  }

  async create(dto: CreateProgramDto): Promise<ProgramModuleItem> {
    const existing = await this.db.queryOne('SELECT code FROM program_modules WHERE code = $1', [dto.code]);
    if (existing) {
      throw new ConflictException(`Mã chương trình "${dto.code}" đã tồn tại.`);
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxRow = await this.db.queryOne('SELECT COALESCE(MAX(sort_order), 0)::int AS max_order FROM program_modules');
      sortOrder = (maxRow?.max_order ?? 0) + 1;
    }

    const row = await this.db.queryOne(
      `INSERT INTO program_modules (code, name, han, card_desc, description, color_1, color_2, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.han,
        dto.cardDesc ?? null,
        dto.description ?? null,
        dto.color1,
        dto.color2 || dto.color1,
        sortOrder,
      ],
    );

    return mapProgram({ ...row, course_count: 0 });
  }

  async update(code: string, dto: UpdateProgramDto): Promise<ProgramModuleItem> {
    const existing = await this.db.queryOne('SELECT code FROM program_modules WHERE code = $1', [code]);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy chương trình học.');
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(dto.name);
    }
    if (dto.han !== undefined) {
      sets.push(`han = $${idx++}`);
      params.push(dto.han);
    }
    if (dto.cardDesc !== undefined) {
      sets.push(`card_desc = $${idx++}`);
      params.push(dto.cardDesc);
    }
    if (dto.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(dto.description);
    }
    if (dto.color1 !== undefined) {
      sets.push(`color_1 = $${idx++}`);
      params.push(dto.color1);
    }
    if (dto.color2 !== undefined) {
      sets.push(`color_2 = $${idx++}`);
      params.push(dto.color2);
    }
    if (dto.sortOrder !== undefined) {
      sets.push(`sort_order = $${idx++}`);
      params.push(dto.sortOrder);
    }

    if (sets.length === 0) {
      const current = await this.db.queryOne(
        `SELECT p.*, COUNT(c.id)::int AS course_count
         FROM program_modules p
         LEFT JOIN courses c ON c.module = p.code
         WHERE p.code = $1
         GROUP BY p.code`,
        [code],
      );
      return mapProgram(current);
    }

    params.push(code);
    await this.db.query(`UPDATE program_modules SET ${sets.join(', ')} WHERE code = $${idx}`, params);

    const updated = await this.db.queryOne(
      `SELECT p.*, COUNT(c.id)::int AS course_count
       FROM program_modules p
       LEFT JOIN courses c ON c.module = p.code
       WHERE p.code = $1
       GROUP BY p.code`,
      [code],
    );
    return mapProgram(updated);
  }

  async remove(code: string): Promise<{ deleted: boolean; code: string }> {
    const existing = await this.db.queryOne('SELECT code FROM program_modules WHERE code = $1', [code]);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy chương trình học.');
    }

    const countRow = await this.db.queryOne('SELECT COUNT(*)::int AS cnt FROM courses WHERE module = $1', [code]);
    const courseCount = Number(countRow?.cnt ?? 0);
    if (courseCount > 0) {
      throw new BadRequestException(
        `Không thể xoá chương trình đang có ${courseCount} khoá học. Hãy chuyển khoá học sang chương trình khác trước.`,
      );
    }

    await this.db.query('DELETE FROM program_modules WHERE code = $1', [code]);
    return { deleted: true, code };
  }
}
