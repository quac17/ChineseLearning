import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { mailerFactory } from '../mail/mail.module';
import { ConsoleMailer } from '../mail/console.mailer';
import {
  checkReset,
  FORGOT_PASSWORD_MESSAGE,
  hashResetToken,
  isRateLimited,
  newResetToken,
  RESET_TTL_MINUTES,
  resetExpiry,
  resetLink,
  resetPasswordMail,
} from './password-reset';
import { PasswordResetService } from './password-reset.service';
import { JwtStrategy } from './jwt.strategy';
import { issuedAfterPasswordChange, SESSION_ENDED_MESSAGE } from './session';

const NOW = new Date('2026-11-22T10:00:00Z');

describe('reset token rules', () => {
  it('stores a SHA-256 hash, never the token itself', () => {
    const { token, tokenHash } = newResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashResetToken(token));
    expect(tokenHash).not.toContain(token);
  });

  it('makes a different token every time', () => {
    expect(newResetToken().token).not.toBe(newResetToken().token);
  });

  it('expires 30 minutes after it is sent', () => {
    expect(RESET_TTL_MINUTES).toBe(30);
    expect(resetExpiry(NOW).toISOString()).toBe('2026-11-22T10:30:00.000Z');
  });

  it('accepts an open link and refuses unknown, used and expired ones', () => {
    const open = { expires_at: resetExpiry(NOW), used_at: null };
    expect(checkReset(open, NOW)).toBe('ok');
    expect(checkReset(null, NOW)).toBe('unknown');
    expect(checkReset({ ...open, used_at: NOW }, NOW)).toBe('used');
    expect(checkReset(open, new Date(NOW.getTime() + 30 * 60_000))).toBe('expired');
    expect(checkReset(open, new Date(NOW.getTime() + 29 * 60_000))).toBe('ok');
  });

  it('puts the token in the URL fragment, so it never reaches a server log', () => {
    expect(resetLink('https://vankinh.vn/', 'abc_DEF-1')).toBe('https://vankinh.vn/reset-password#token=abc_DEF-1');
  });

  it('limits links per account and per IP', () => {
    const limits = { perEmail: 3, perIp: 10 };
    expect(isRateLimited({ byEmail: 2, byIp: 9 }, limits)).toBe(false);
    expect(isRateLimited({ byEmail: 3, byIp: 0 }, limits)).toBe(true);
    expect(isRateLimited({ byEmail: 0, byIp: 10 }, limits)).toBe(true);
  });

  it('escapes the learner name in the HTML mail', () => {
    const mail = resetPasswordMail('a@b.vn', '<script>x</script>', 'https://x/reset-password#token=t');
    expect(mail.html).not.toContain('<script>x');
    expect(mail.text).toContain('https://x/reset-password#token=t');
    expect(mail.subject).toBe('Đặt lại mật khẩu Vân Kính');
  });
});

function config(values: Record<string, string> = {}) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('PasswordResetService.requestReset', () => {
  function setup(user: object | null, recent = { by_email: 0, by_ip: 0 }) {
    const db = {
      queryOne: jest.fn().mockResolvedValueOnce(user).mockResolvedValueOnce(recent),
      query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    };
    const mail = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(
      db as unknown as DatabaseService,
      mail as unknown as MailService,
      config({ APP_URL: 'https://web.test' }),
    );
    return { service, db, mail };
  }
  const active = { id: 'user-1', email: 'lan@example.com', full_name: 'Lan', is_active: true };

  it('answers the same for an unknown email and sends nothing', async () => {
    const { service, db, mail } = setup(null);
    await expect(service.requestReset('nobody@example.com', '1.2.3.4')).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(db.query).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('sends nothing to a locked account', async () => {
    const { service, mail } = setup({ ...active, is_active: false });
    await expect(service.requestReset(active.email, null)).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('stores the hash and mails the raw token', async () => {
    const { service, db, mail } = setup(active);
    await expect(service.requestReset('  LAN@example.com ', '1.2.3.4')).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });

    expect(db.queryOne.mock.calls[0][1]).toEqual(['lan@example.com']);
    const [, params] = db.query.mock.calls[0];
    const [, userId, storedHash, ip] = params;
    expect([userId, ip]).toEqual(['user-1', '1.2.3.4']);

    const sent = mail.send.mock.calls[0][0];
    expect(sent.to).toBe('lan@example.com');
    const token = decodeURIComponent(/#token=([^\s"<]+)/.exec(sent.text)![1]);
    expect(sent.text).toContain('https://web.test/reset-password#token=');
    expect(hashResetToken(token)).toBe(storedHash);
    expect(JSON.stringify(params)).not.toContain(token);
  });

  it('sends nothing past the hourly limit, with the same answer', async () => {
    const { service, db, mail } = setup(active, { by_email: 3, by_ip: 0 });
    await expect(service.requestReset(active.email, '1.2.3.4')).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(db.query).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('keeps the same answer when the mail backend fails', async () => {
    const { service, mail } = setup(active);
    mail.send.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(service.requestReset(active.email, null)).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });
  });
});

describe('PasswordResetService.resetPassword', () => {
  function setup(row: object | null) {
    const tx = { query: jest.fn() };
    tx.query.mockResolvedValueOnce({ rows: row ? [row] : [] }).mockResolvedValue({ rowCount: 1 });
    const db = { withTransaction: jest.fn((work: (c: typeof tx) => unknown) => work(tx)) };
    const service = new PasswordResetService(db as unknown as DatabaseService, {} as MailService, config());
    return { service, tx };
  }
  const token = 'a-token-long-enough-to-pass-the-dto';

  it('sets the new password and closes every open link of the account', async () => {
    const { service, tx } = setup({ id: 'pwr-1', user_id: 'user-1', expires_at: new Date(Date.now() + 60_000), used_at: null });
    await expect(service.resetPassword(token, 'matkhau-moi')).resolves.toEqual({ reset: true });

    expect(tx.query.mock.calls[0][1]).toEqual([hashResetToken(token)]);
    const [updateSql, [hash, userId, changedAt]] = tx.query.mock.calls[1];
    expect(updateSql).toContain('UPDATE users SET password_hash');
    expect(updateSql).toContain('password_changed_at = $3');
    expect(userId).toBe('user-1');
    expect(changedAt).toBeInstanceOf(Date);
    expect(await bcrypt.compare('matkhau-moi', hash)).toBe(true);
    expect(tx.query.mock.calls[2]).toEqual([
      'UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      ['user-1'],
    ]);
  });

  it.each([
    ['unknown', null, 'không hợp lệ'],
    ['used', { id: 'p', user_id: 'u', expires_at: new Date(Date.now() + 60_000), used_at: new Date() }, 'đã được dùng'],
    ['expired', { id: 'p', user_id: 'u', expires_at: new Date(Date.now() - 1), used_at: null }, 'hết hạn'],
  ])('refuses a %s link and changes nothing', async (_name, row, message) => {
    const { service, tx } = setup(row);
    const attempt = service.resetPassword(token, 'matkhau-moi');
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toThrow(message);
    expect(tx.query).toHaveBeenCalledTimes(1);
  });
});

describe('mailerFactory', () => {
  it('refuses the console mailer in production', () => {
    expect(() => mailerFactory(config({ NODE_ENV: 'production' }))).toThrow('MAIL_TRANSPORT=smtp');
    expect(() => mailerFactory(config({ NODE_ENV: 'production', MAIL_TRANSPORT: 'console' }))).toThrow();
  });

  it('needs every SMTP setting', () => {
    expect(() => mailerFactory(config({ MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.example.com' }))).toThrow('SMTP_USER');
  });

  it('builds an SMTP mailer in production when configured', () => {
    const mailer = mailerFactory(
      config({
        NODE_ENV: 'production',
        MAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        MAIL_FROM: 'Vân Kính <no-reply@example.com>',
      }),
    );
    expect(mailer.name).toBe('smtp');
  });

  it('keeps an outbox only when MAIL_DEV_OUTBOX=true', async () => {
    const plain = mailerFactory(config()) as ConsoleMailer;
    expect(plain.hasOutbox).toBe(false);
    const withOutbox = mailerFactory(config({ MAIL_DEV_OUTBOX: 'true' })) as ConsoleMailer;
    await withOutbox.send({ to: 'Lan@Example.com', subject: 's', text: 't', html: 'h' });
    expect(withOutbox.mailsTo('lan@example.com')).toHaveLength(1);
  });
});

describe('sessions end when the password changes', () => {
  const changedAt = new Date('2026-11-22T10:00:00.400Z');
  const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

  it('accepts any token when the password was never changed', () => {
    expect(issuedAfterPasswordChange(sec('2020-01-01T00:00:00Z'), null)).toBe(true);
  });

  it('refuses a token issued before the change', () => {
    expect(issuedAfterPasswordChange(sec('2026-11-22T09:59:59.900Z'), changedAt)).toBe(false);
    expect(issuedAfterPasswordChange(sec('2026-11-21T10:00:00Z'), changedAt)).toBe(false);
    expect(issuedAfterPasswordChange(undefined, changedAt)).toBe(false);
  });

  it('accepts the token issued right after the change, in the same second (~1s skew)', () => {
    expect(issuedAfterPasswordChange(sec('2026-11-22T10:00:00.700Z'), changedAt)).toBe(true);
    expect(issuedAfterPasswordChange(sec('2026-11-22T10:00:05Z'), changedAt.toISOString())).toBe(true);
  });

  it('JwtStrategy rejects a token older than password_changed_at', async () => {
    const row = { id: 'user-1', email: 'a@b.vn', full_name: 'A', role: 'STUDENT', is_active: true, password_changed_at: changedAt };
    const db = { queryOne: jest.fn().mockResolvedValue(row) };
    const strategy = new JwtStrategy(config({ JWT_SECRET: 'x' }), db as unknown as DatabaseService);
    const payload = { sub: 'user-1', email: 'a@b.vn', role: 'STUDENT' };
    await expect(strategy.validate({ ...payload, iat: sec('2026-11-22T09:00:00Z') })).rejects.toThrow(SESSION_ENDED_MESSAGE);
    await expect(strategy.validate({ ...payload, iat: sec('2026-11-22T10:00:01Z') })).resolves.toMatchObject({ id: 'user-1' });
  });
});
