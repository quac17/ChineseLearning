import { createHmac, timingSafeEqual } from 'crypto';
import { MailMessage } from '../mail/mailer';

/**
 * Rules of the daily review reminder (#38), kept free of Nest and SQL.
 *
 * - "One mail a day" counts Vietnam calendar days (UTC+7, no daylight saving),
 *   so a job at 19:00 and a retry at 23:00 fall on the same day.
 * - The unsubscribe link is signed with an HMAC of the user id, so it works
 *   without logging in and cannot be forged for another learner.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The calendar day in Vietnam, as YYYY-MM-DD. */
export function vietnamDay(now: Date): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

const UNSUBSCRIBE_LABEL = 'chinese_learner:review-reminder-unsubscribe:';

export function unsubscribeSignature(secret: string, userId: string): string {
  return createHmac('sha256', secret).update(UNSUBSCRIBE_LABEL + userId).digest('base64url');
}

export function isValidUnsubscribe(secret: string, userId: string, signature: string): boolean {
  const expected = Buffer.from(unsubscribeSignature(secret, userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Cloud Scheduler's shared secret. An unset secret disables the endpoint. */
export function isValidCronSecret(configured: string | undefined, given: string | undefined): boolean {
  if (!configured || !given) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ReminderLinks {
  /** The flashcards on today's due words. */
  review: string;
  /** Web page with a "Tắt nhắc ôn tập" button. */
  unsubscribePage: string;
  /** One-click POST target for mail clients (RFC 8058), when the API's public URL is known. */
  unsubscribeOneClick: string | null;
}

export function reminderLinks(
  appUrl: string,
  apiUrl: string | null,
  userId: string,
  signature: string,
): ReminderLinks {
  const web = appUrl.replace(/\/$/, '');
  const qs = `u=${encodeURIComponent(userId)}&s=${encodeURIComponent(signature)}`;
  return {
    review: `${web}/flashcards?due=true`,
    unsubscribePage: `${web}/unsubscribe?${qs}`,
    unsubscribeOneClick: apiUrl ? `${apiUrl.replace(/\/$/, '')}/reminders/unsubscribe?${qs}` : null,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const REMINDER_SUBJECT = 'Hôm nay bạn có từ cần ôn';

export function reviewReminderMail(to: string, fullName: string, dueCount: number, links: ReminderLinks): MailMessage {
  const name = fullName.trim() || 'bạn';
  const words = `${dueCount} từ`;
  const text = [
    `Chào ${name},`,
    '',
    `Hôm nay bạn có ${words} đến hạn ôn trong hộp ôn tập. Ôn vài phút mỗi ngày giúp nhớ lâu hơn.`,
    `Ôn ngay: ${links.review}`,
    '',
    `Không muốn nhận nhắc ôn tập nữa? Tắt tại: ${links.unsubscribePage}`,
    'Bạn cũng có thể tắt "Nhắc ôn tập mỗi ngày" trong trang Tài khoản.',
    '',
    'Chinese Learner',
  ].join('\n');
  const html = `<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#F7F9FA;font-family:'Be Vietnam Pro',Arial,sans-serif;color:#1C1D1F">
<div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D1D7DC;border-radius:4px;padding:28px">
<p style="margin:0 0 16px;font-size:20px;font-weight:800">Hôm nay bạn có ${escapeHtml(words)} cần ôn</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.55">Chào ${escapeHtml(name)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55">Các từ này đã đến hạn trong hộp ôn tập. Ôn vài phút mỗi ngày giúp nhớ lâu hơn.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(links.review)}" style="display:inline-block;background:#1C1D1F;color:#FFFFFF;font-weight:700;font-size:16px;text-decoration:none;padding:14px 22px;border-radius:4px">Ôn ngay</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6A6F73">Bạn nhận email này vì đã bật "Nhắc ôn tập mỗi ngày". <a href="${escapeHtml(links.unsubscribePage)}" style="color:#C2321C">Tắt nhắc ôn tập</a></p>
</div></body></html>`;
  const headers: Record<string, string> = links.unsubscribeOneClick
    ? { 'List-Unsubscribe': `<${links.unsubscribeOneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : { 'List-Unsubscribe': `<${links.unsubscribePage}>` };
  return { to, subject: REMINDER_SUBJECT, text, html, headers };
}
