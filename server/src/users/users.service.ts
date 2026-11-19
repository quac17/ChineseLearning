import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { generateId, Role } from '../common/types/domain.types';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const rows = await this.db.queryAll(
      `SELECT u.id, u.email, u.full_name, u.phone, u.bio, u.role, u.is_active, u.created_at,
              (SELECT COUNT(*)::int FROM courses c WHERE c.teacher_id = u.id) AS taught_courses_count,
              (SELECT COUNT(*)::int FROM course_enrollments e WHERE e.student_id = u.id AND e.can_view = TRUE) AS enrollments_count
       FROM users u
       ORDER BY u.created_at DESC`,
    );

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      phone: r.phone,
      bio: r.bio,
      role: r.role as Role,
      isActive: r.is_active,
      createdAt: r.created_at,
      _count: {
        taughtCourses: r.taught_courses_count,
        enrollments: r.enrollments_count,
      },
    }));
  }

  async findStudents() {
    const rows = await this.db.queryAll(
      `SELECT id, email, full_name, phone, role, created_at
       FROM users
       WHERE role = 'STUDENT' AND is_active = TRUE
       ORDER BY full_name ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      phone: r.phone,
      role: r.role,
      createdAt: r.created_at,
    }));
  }

  async getStats() {
    const row = await this.db.queryOne(
      `SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'ADMIN') AS admins,
        (SELECT COUNT(*)::int FROM users WHERE role = 'TEACHER') AS teachers,
        (SELECT COUNT(*)::int FROM users WHERE role = 'STUDENT') AS students,
        (SELECT COUNT(*)::int FROM courses) AS courses,
        (SELECT COUNT(*)::int FROM lessons) AS lessons,
        (SELECT COUNT(*)::int FROM course_documents) AS documents,
        (SELECT COUNT(*)::int FROM course_enrollments WHERE can_view = TRUE) AS active_enrollments`,
    );

    return {
      admins: row.admins,
      teachers: row.teachers,
      students: row.students,
      totalUsers: row.admins + row.teachers + row.students,
      courses: row.courses,
      lessons: row.lessons,
      documents: row.documents,
      activeEnrollments: row.active_enrollments,
    };
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    if (existing) {
      throw new ConflictException('Email này đã tồn tại trong hệ thống.');
    }

    const id = generateId('user');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.db.queryOne(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, phone, bio, role, is_active, created_at`,
      [id, email, passwordHash, dto.fullName.trim(), dto.phone?.trim() || null, dto.role],
    );

    return {
      id: created.id,
      email: created.email,
      fullName: created.full_name,
      phone: created.phone,
      bio: created.bio,
      role: created.role,
      isActive: created.is_active,
      createdAt: created.created_at,
    };
  }

  async update(id: string, dto: UpdateUserDto, currentAdminId: string) {
    const user = await this.db.queryOne('SELECT id FROM users WHERE id = $1', [id]);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng.');
    }

    if (id === currentAdminId && dto.role && dto.role !== Role.ADMIN) {
      throw new BadRequestException('Không thể tự hạ quyền Admin của chính mình.');
    }
    if (id === currentAdminId && dto.isActive === false) {
      throw new BadRequestException('Không thể tự khóa tài khoản của chính mình.');
    }

    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.fullName !== undefined) {
      sets.push(`full_name = $${idx++}`);
      params.push(dto.fullName.trim());
    }
    if (dto.phone !== undefined) {
      sets.push(`phone = $${idx++}`);
      params.push(dto.phone.trim() || null);
    }
    if (dto.bio !== undefined) {
      sets.push(`bio = $${idx++}`);
      params.push(dto.bio.trim() || null);
    }
    if (dto.role !== undefined) {
      sets.push(`role = $${idx++}`);
      params.push(dto.role);
    }
    if (dto.isActive !== undefined) {
      sets.push(`is_active = $${idx++}`);
      params.push(dto.isActive);
    }
    if (dto.password) {
      sets.push(`password_hash = $${idx++}`);
      params.push(await bcrypt.hash(dto.password, 10));
    }

    params.push(id);
    const updated = await this.db.queryOne(
      `UPDATE users
       SET ${sets.join(', ')}
       WHERE id = $${idx}
       RETURNING id, email, full_name, phone, bio, role, is_active, created_at`,
      params,
    );

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.full_name,
      phone: updated.phone,
      bio: updated.bio,
      role: updated.role,
      isActive: updated.is_active,
      createdAt: updated.created_at,
    };
  }

  async remove(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('Không thể tự xóa tài khoản Admin của chính mình.');
    }
    const res = await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    if (!res.rowCount) {
      throw new NotFoundException('Không tìm thấy người dùng.');
    }
    return { deleted: true, id };
  }
}
