import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { watchableSql } from '../practice/practice.service';
import {
  isValidUnsubscribe,
  reminderLinks,
  reviewReminderMail,
  unsubscribeSignature,
  vietnamDay,
} from './review-reminder';

export interface ReminderRunResult {
  day: string;
  /** Opted-in learners with due words who had no reminder yet today. */
  candidates: number;
  sent: number;
  /** Already claimed by a run in parallel. */
  skipped: number;
  failed: number;
}

interface Candidate {
  id: string;
  email: string;
  full_name: string;
  last_sent_on: string | null;
  due_count: number;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger('Reminders');
  private readonly appUrl: string;
  private readonly apiUrl: string | null;
  private readonly secret: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.appUrl = config.get<string>('APP_URL') || 'http://localhost:3000';
    this.apiUrl = config.get<string>('API_PUBLIC_URL') || null;
    // Same fallback as AuthModule, so local links keep working without a .env.
    this.secret = config.get<string>('JWT_SECRET') || 'dev_jwt_secret';
  }

  async settings(userId: string): Promise<{ enabled: boolean }> {
    const row = await this.db.queryOne<{ enabled: boolean }>('SELECT enabled FROM review_reminders WHERE user_id = $1', [userId]);
    return { enabled: row?.enabled ?? false };
  }

  async setEnabled(userId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    const row = await this.db.queryOne<{ enabled: boolean }>(
      `INSERT INTO review_reminders (user_id, enabled) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
       RETURNING enabled`,
      [userId, enabled],
    );
    return { enabled: row!.enabled };
  }

  /** The signed link in the mail: turns the reminder off without logging in. */
  async unsubscribe(userId: string, signature: string): Promise<{ enabled: false }> {
    if (!userId || !signature || !isValidUnsubscribe(this.secret, userId, signature)) {
      throw new BadRequestException('Đường dẫn huỷ nhận nhắc ôn tập không hợp lệ.');
    }
    await this.db.query('UPDATE review_reminders SET enabled = false, updated_at = now() WHERE user_id = $1', [userId]);
    return { enabled: false };
  }

  /**
   * Emails every opted-in, active learner who has words due now and has not
   * had a reminder today (Vietnam day). Each mail first claims the day by
   * moving last_sent_on forward, so two runs at once never send twice; a
   * failed send gives the day back so a later run can retry.
   */
  async run(now = new Date()): Promise<ReminderRunResult> {
    const day = vietnamDay(now);
    const candidates = await this.db.queryAll<Candidate>(
      `SELECT u.id, u.email, u.full_name, rr.last_sent_on::text AS last_sent_on, count(r.id)::int AS due_count
       FROM review_reminders rr
       JOIN users u ON u.id = rr.user_id AND u.is_active
       JOIN vocab_reviews r ON r.user_id = u.id AND r.due_at <= $2
       JOIN lesson_vocabulary v ON v.id = r.vocabulary_id
       JOIN lessons l ON l.id = v.lesson_id
       JOIN courses c ON c.id = l.course_id
       WHERE rr.enabled AND (rr.last_sent_on IS NULL OR rr.last_sent_on < $1::date)
         AND ${watchableSql('u.id', "(u.role = 'ADMIN')")}
       GROUP BY u.id, rr.last_sent_on
       ORDER BY u.id`,
      [day, now],
    );

    const result: ReminderRunResult = { day, candidates: candidates.length, sent: 0, skipped: 0, failed: 0 };
    for (const c of candidates) {
      const claimed = await this.db.query(
        `UPDATE review_reminders SET last_sent_on = $2::date, updated_at = now()
         WHERE user_id = $1 AND enabled AND (last_sent_on IS NULL OR last_sent_on < $2::date)`,
        [c.id, day],
      );
      if (!claimed.rowCount) {
        result.skipped += 1;
        continue;
      }
      const links = reminderLinks(this.appUrl, this.apiUrl, c.id, unsubscribeSignature(this.secret, c.id));
      try {
        await this.mail.send(reviewReminderMail(c.email, c.full_name, c.due_count, links));
        result.sent += 1;
      } catch {
        result.failed += 1;
        await this.db.query(
          'UPDATE review_reminders SET last_sent_on = $3::date WHERE user_id = $1 AND last_sent_on = $2::date',
          [c.id, day, c.last_sent_on],
        );
      }
    }
    this.logger.log(
      `Nhắc ôn tập ${day}: ${result.sent} đã gửi, ${result.skipped} bỏ qua, ${result.failed} lỗi (${result.candidates} người có từ đến hạn).`,
    );
    return result;
  }
}
