import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

function buildJwtExtractor(cookieName: string) {
  return (req: Request): string | null => {
    // 1. Ưu tiên đọc từ HTTP-only Cookie (duy trì đăng nhập trên trình duyệt)
    const fromCookie = req?.cookies?.[cookieName];
    if (typeof fromCookie === 'string' && fromCookie.length > 0) {
      return fromCookie;
    }
    // 2. Fallback Authorization: Bearer <token>
    const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (fromHeader) return fromHeader;
    // 3. Fallback query string ?token=...
    const queryToken = req?.query?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }
    return null;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly db: DatabaseService,
  ) {
    const cookieName = configService.get<string>('COOKIE_NAME') || 'chinese_learner_token';
    super({
      jwtFromRequest: buildJwtExtractor(cookieName),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'dev_jwt_secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.db.queryOne(
      `SELECT id, email, full_name, phone, bio, role, is_active, created_at
       FROM users
       WHERE id = $1`,
      [payload.sub],
    );

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      bio: user.bio,
      role: user.role,
      createdAt: user.created_at,
    };
  }
}
