import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { generateId } from '../common/types/domain.types';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import {
  checkReset,
  DEFAULT_RESET_LIMITS,
  FORGOT_PASSWORD_MESSAGE,
  hashResetToken,
  isRateLimited,
  newResetToken,
  RESET_ERRORS,
  resetExpiry,
  resetLink,
  resetPasswordMail,
} from './password-reset';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger('PasswordReset');
  private readonly appUrl: string;
  private readonly limits: { perEmail: number; perIp: number };

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.appUrl = config.get<string>('APP_URL') || 'http://localhost:3000';
    this.limits = {
      perEmail: Number(config.get<string>('PASSWORD_RESET_MAX_PER_EMAIL')) || DEFAULT_RESET_LIMITS.perEmail,
      perIp: Number(config.get<string>('PASSWORD_RESET_MAX_PER_IP')) || DEFAULT_RESET_LIMITS.perIp,
    };
  }

  /**
   * Sends a reset link if the email belongs to an active account and the
   * hourly limits allow it. The answer is the same in every case, so the
   * endpoint never tells whether an email is registered.
   */
  async requestReset(rawEmail: string, ip: string | null): Promise<{ message: string }> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.db.queryOne<{ id: string; email: string; full_name: string; is_active: boolean }>(
      'SELECT id, email, full_name, is_active FROM users WHERE email = $1',
      [email],
    );
    if (!user || !user.is_active) return { message: FORGOT_PASSWORD_MESSAGE };

    const recent = await this.db.queryOne<{ by_email: number; by_ip: number }>(
      `SELECT count(*) FILTER (WHERE user_id = $1)::int AS by_email,
              count(*) FILTER (WHERE $2::varchar IS NOT NULL AND requested_ip = $2)::int AS by_ip
       FROM password_resets
       WHERE created_at > now() - interval '1 hour' AND (user_id = $1 OR requested_ip = $2)`,
      [user.id, ip],
    );
    if (isRateLimited({ byEmail: recent?.by_email ?? 0, byIp: recent?.by_ip ?? 0 }, this.limits)) {
      this.logger.warn(`Bỏ qua yêu cầu đặt lại mật khẩu (quá giới hạn mỗi giờ) cho ${user.id}.`);
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const { token, tokenHash } = newResetToken();
    await this.db.query(
      `INSERT INTO password_resets (id, user_id, token_hash, requested_ip, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [generateId('pwr'), user.id, tokenHash, ip, resetExpiry(new Date())],
    );
    try {
      await this.mail.send(resetPasswordMail(user.email, user.full_name, resetLink(this.appUrl, token)));
    } catch {
      // Already logged by MailService. Answering differently would reveal that the account exists.
    }
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  /** Uses a link once: sets the new password and closes every other open link of that account. */
  async resetPassword(token: string, password: string): Promise<{ reset: true }> {
    const tokenHash = hashResetToken(token);
    const passwordHash = await bcrypt.hash(password, 10);
    return this.db.withTransaction(async (tx) => {
      const row = (
        await tx.query(
          'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1 FOR UPDATE',
          [tokenHash],
        )
      ).rows[0] ?? null;
      const check = checkReset(row, new Date());
      if (check !== 'ok') throw new BadRequestException(RESET_ERRORS[check]);

      await tx.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, row.user_id]);
      await tx.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
      return { reset: true as const };
    });
  }
}
