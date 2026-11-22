import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { generateId, Role } from '../common/types/domain.types';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

function mapUserRow(row: any) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? null,
    bio: row.bio ?? null,
    role: row.role as Role,
    termsAcceptedAt: row.terms_accepted_at ?? null,
    createdAt: row.created_at,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký.');
    }

    const id = generateId('user');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.db.queryOne(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, full_name, phone, bio, role, terms_accepted_at, created_at`,
      [id, email, passwordHash, dto.fullName.trim(), dto.phone?.trim() || null, Role.STUDENT],
    );

    const user = mapUserRow(created);
    const accessToken = await this.signToken(user.id, user.email, user.role);
    return { accessToken, user };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const row = await this.db.queryOne(
      `SELECT id, email, password_hash, full_name, phone, bio, role, is_active, terms_accepted_at, created_at
       FROM users
       WHERE email = $1`,
      [email],
    );

    if (!row) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    if (!row.is_active) {
      throw new UnauthorizedException('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
    }

    const valid = await bcrypt.compare(dto.password, row.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    const user = mapUserRow(row);
    const accessToken = await this.signToken(user.id, user.email, user.role);
    return { accessToken, user };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.db.queryOne(
      `UPDATE users
       SET full_name = $1, phone = $2, bio = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, full_name, phone, bio, role, terms_accepted_at, created_at`,
      [dto.fullName.trim(), dto.phone?.trim() || null, dto.bio?.trim() || null, userId],
    );

    return { user: mapUserRow(updated) };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const row = await this.db.queryOne(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId],
    );
    if (!row) {
      throw new UnauthorizedException('Không tìm thấy tài khoản.');
    }

    const valid = await bcrypt.compare(dto.currentPassword, row.password_hash);
    if (!valid) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId],
    );

    return { updated: true };
  }

  private async signToken(userId: string, email: string, role: Role): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, email, role });
  }
}
