import { createHash, randomBytes } from 'crypto';
import { MailMessage } from '../mail/mailer';

/**
 * Rules of the "forgot password" link (#31), kept free of Nest and SQL so
 * they are easy to test.
 *
 * - The token is 32 random bytes (base64url). Only its SHA-256 hash is
 *   stored, so a copy of the database cannot reset anyone's password.
 * - A link lasts 30 minutes and works once.
 * - The link carries the token in the URL fragment (#token=…): fragments are
 *   never sent to a server or in a Referer header, so the token stays out of
 *   access logs and third-party requests.
 */
export const RESET_TTL_MINUTES = 30;

export const DEFAULT_RESET_LIMITS = { perEmail: 3, perIp: 10 } as const;

/** The one answer to POST /auth/forgot-password, whether the email exists or not. */
export const FORGOT_PASSWORD_MESSAGE =
  'Nếu email này có tài khoản, chúng tôi đã gửi đường dẫn đặt lại mật khẩu. Hãy kiểm tra hộp thư, cả thư mục Spam.';

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function newResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashResetToken(token) };
}

export function resetExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TTL_MINUTES * 60_000);
}

export function resetLink(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, '')}/reset-password#token=${encodeURIComponent(token)}`;
}

export type ResetCheck = 'ok' | 'unknown' | 'used' | 'expired';

export function checkReset(row: { expires_at: Date | string; used_at: Date | string | null } | null, now: Date): ResetCheck {
  if (!row) return 'unknown';
  if (row.used_at) return 'used';
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'ok';
}

export const RESET_ERRORS: Record<Exclude<ResetCheck, 'ok'>, string> = {
  unknown: 'Đường dẫn đặt lại mật khẩu không hợp lệ. Hãy yêu cầu đường dẫn mới.',
  used: 'Đường dẫn này đã được dùng. Hãy yêu cầu đường dẫn mới nếu bạn vẫn cần đổi mật khẩu.',
  expired: 'Đường dẫn đã hết hạn (sau 30 phút). Hãy yêu cầu đường dẫn mới.',
};

/** Links sent in the last hour, to this account and from this IP. */
export interface RecentResets {
  byEmail: number;
  byIp: number;
}

export function isRateLimited(recent: RecentResets, limits: { perEmail: number; perIp: number }): boolean {
  return recent.byEmail >= limits.perEmail || recent.byIp >= limits.perIp;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function resetPasswordMail(to: string, fullName: string, link: string): MailMessage {
  const name = fullName.trim() || 'bạn';
  const text = [
    `Chào ${name},`,
    '',
    'Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu tài khoản Chinese Learner.',
    `Mở đường dẫn sau để đặt mật khẩu mới (hiệu lực ${RESET_TTL_MINUTES} phút, dùng một lần):`,
    link,
    '',
    'Nếu bạn không yêu cầu, hãy bỏ qua email này: mật khẩu của bạn không đổi.',
    '',
    'Chinese Learner',
  ].join('\n');
  const html = `<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#F7F9FA;font-family:'Be Vietnam Pro',Arial,sans-serif;color:#1C1D1F">
<div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D1D7DC;border-radius:4px;padding:28px">
<p style="margin:0 0 16px;font-size:20px;font-weight:800">Đặt lại mật khẩu</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.55">Chào ${escapeHtml(name)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55">Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu tài khoản Chinese Learner. Đường dẫn có hiệu lực ${RESET_TTL_MINUTES} phút và chỉ dùng được một lần.</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1C1D1F;color:#FFFFFF;font-weight:700;font-size:16px;text-decoration:none;padding:14px 22px;border-radius:4px">Đặt mật khẩu mới</a></p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#6A6F73">Nút không bấm được? Dán đường dẫn này vào trình duyệt:<br><a href="${escapeHtml(link)}" style="color:#C2321C;word-break:break-all">${escapeHtml(link)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6A6F73">Nếu bạn không yêu cầu, hãy bỏ qua email này: mật khẩu của bạn không đổi.</p>
</div></body></html>`;
  return { to, subject: 'Đặt lại mật khẩu Chinese Learner', text, html };
}
