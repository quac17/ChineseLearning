import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { RemindersService } from './reminders.service';
import {
  isValidCronSecret,
  isValidUnsubscribe,
  reminderLinks,
  REMINDER_SUBJECT,
  reviewReminderMail,
  unsubscribeSignature,
  vietnamDay,
} from './review-reminder';

describe('review reminder rules', () => {
  it('counts days in Vietnam time (UTC+7)', () => {
    expect(vietnamDay(new Date('2026-11-22T16:59:59Z'))).toBe('2026-11-22');
    expect(vietnamDay(new Date('2026-11-22T17:00:00Z'))).toBe('2026-11-23');
    expect(vietnamDay(new Date('2026-11-22T00:00:00Z'))).toBe('2026-11-22');
  });

  it('signs unsubscribe links per learner', () => {
    const sig = unsubscribeSignature('secret', 'user-1');
    expect(isValidUnsubscribe('secret', 'user-1', sig)).toBe(true);
    expect(isValidUnsubscribe('secret', 'user-2', sig)).toBe(false);
    expect(isValidUnsubscribe('other-secret', 'user-1', sig)).toBe(false);
    expect(isValidUnsubscribe('secret', 'user-1', 'short')).toBe(false);
  });

  it('refuses the run endpoint when no secret is configured', () => {
    expect(isValidCronSecret(undefined, 'anything')).toBe(false);
    expect(isValidCronSecret('', '')).toBe(false);
    expect(isValidCronSecret('s3cret', undefined)).toBe(false);
    expect(isValidCronSecret('s3cret', 's3cre')).toBe(false);
    expect(isValidCronSecret('s3cret', 's3cret')).toBe(true);
  });

  it('builds the review and unsubscribe links', () => {
    expect(reminderLinks('https://vankinh.vn/', null, 'user-1', 'a+b')).toEqual({
      review: 'https://vankinh.vn/flashcards?due=true',
      unsubscribePage: 'https://vankinh.vn/unsubscribe?u=user-1&s=a%2Bb',
      unsubscribeOneClick: null,
    });
    expect(reminderLinks('https://vankinh.vn', 'https://api.vankinh.vn/api', 'u', 's').unsubscribeOneClick).toBe(
      'https://api.vankinh.vn/api/reminders/unsubscribe?u=u&s=s',
    );
  });

  it('writes the mail with the due count and an unsubscribe link', () => {
    const links = reminderLinks('https://web.test', 'https://api.test/api', 'user-1', 'sig');
    const mail = reviewReminderMail('lan@example.com', '<Lan>', 7, links);
    expect(mail.subject).toBe(REMINDER_SUBJECT);
    expect(mail.text).toContain('7 từ');
    expect(mail.text).toContain('https://web.test/flashcards?due=true');
    expect(mail.text).toContain('https://web.test/unsubscribe?u=user-1&s=sig');
    expect(mail.html).not.toContain('<Lan>');
    expect(mail.headers).toEqual({
      'List-Unsubscribe': '<https://api.test/api/reminders/unsubscribe?u=user-1&s=sig>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });
});

function config(values: Record<string, string> = {}) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('RemindersService.run', () => {
  const lan = { id: 'user-1', email: 'lan@example.com', full_name: 'Lan', last_sent_on: null, due_count: 3 };
  const minh = { id: 'user-2', email: 'minh@example.com', full_name: 'Minh', last_sent_on: '2026-11-21', due_count: 1 };
  const NOW = new Date('2026-11-22T12:00:00Z');

  function setup(candidates: object[], claimed: number[]) {
    const db = {
      queryAll: jest.fn().mockResolvedValue(candidates),
      query: jest.fn(),
    };
    for (const n of claimed) db.query.mockResolvedValueOnce({ rowCount: n });
    db.query.mockResolvedValue({ rowCount: 1 });
    const mail = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new RemindersService(
      db as unknown as DatabaseService,
      mail as unknown as MailService,
      config({ APP_URL: 'https://web.test', JWT_SECRET: 'secret' }),
    );
    return { service, db, mail };
  }

  it('claims today for each learner before mailing them', async () => {
    const { service, db, mail } = setup([lan, minh], [1, 1]);
    await expect(service.run(NOW)).resolves.toEqual({ day: '2026-11-22', candidates: 2, sent: 2, skipped: 0, failed: 0 });
    expect(db.queryAll.mock.calls[0][1]).toEqual(['2026-11-22', NOW]);
    expect(db.query.mock.calls[0][1]).toEqual(['user-1', '2026-11-22']);
    expect(mail.send).toHaveBeenCalledTimes(2);
    const first = mail.send.mock.calls[0][0];
    expect(first.to).toBe('lan@example.com');
    expect(first.text).toContain(`u=user-1&s=${unsubscribeSignature('secret', 'user-1')}`);
  });

  it('skips a learner whose day was already claimed by another run', async () => {
    const { service, mail } = setup([lan, minh], [0, 1]);
    await expect(service.run(NOW)).resolves.toMatchObject({ sent: 1, skipped: 1 });
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe('minh@example.com');
  });

  it('gives the day back when the mail fails, so a later run retries', async () => {
    const { service, db, mail } = setup([minh], [1]);
    mail.send.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(service.run(NOW)).resolves.toMatchObject({ sent: 0, failed: 1 });
    expect(db.query.mock.calls[1]).toEqual([
      'UPDATE review_reminders SET last_sent_on = $3::date WHERE user_id = $1 AND last_sent_on = $2::date',
      ['user-2', '2026-11-22', '2026-11-21'],
    ]);
  });

  it('sends nothing when nobody is due', async () => {
    const { service, db, mail } = setup([], []);
    await expect(service.run(NOW)).resolves.toMatchObject({ candidates: 0, sent: 0 });
    expect(db.query).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('only selects opted-in, active learners not yet reminded today, with words they may still watch', async () => {
    const { service, db } = setup([], []);
    await service.run(NOW);
    const sql: string = db.queryAll.mock.calls[0][0];
    expect(sql).toContain('rr.enabled');
    expect(sql).toContain('u.is_active');
    expect(sql).toContain('rr.last_sent_on < $1::date');
    expect(sql).toContain('r.due_at <= $2');
    expect(sql).toContain('e.student_id = u.id AND e.can_view = TRUE');
  });
});

describe('RemindersService.unsubscribe', () => {
  function setup() {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const service = new RemindersService(db as unknown as DatabaseService, {} as MailService, config({ JWT_SECRET: 'secret' }));
    return { service, db };
  }

  it('turns the reminder off with a valid signature', async () => {
    const { service, db } = setup();
    await expect(service.unsubscribe('user-1', unsubscribeSignature('secret', 'user-1'))).resolves.toEqual({ enabled: false });
    expect(db.query.mock.calls[0][1]).toEqual(['user-1']);
  });

  it('refuses a forged or missing signature', async () => {
    const { service, db } = setup();
    await expect(service.unsubscribe('user-1', unsubscribeSignature('secret', 'user-2'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.unsubscribe('user-1', '')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
