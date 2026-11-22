import { APIRequestContext, expect } from '@playwright/test';
import { API_URL } from '../env';

export interface DevMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  sentAt: string;
}

/**
 * Mails the console mailer kept for `to`, newest first (GET /api/dev/mails,
 * on only in the e2e stack: MAIL_TRANSPORT=console + MAIL_DEV_OUTBOX=true).
 */
export async function mailsTo(api: APIRequestContext, to: string, subject?: string): Promise<DevMail[]> {
  const res = await api.get(`${API_URL}/dev/mails`, { params: { to } });
  expect(res.status(), await res.text()).toBe(200);
  const mails = (await res.json()) as DevMail[];
  return subject ? mails.filter((m) => m.subject === subject) : mails;
}

/** The first link in a mail's plain text that starts with `prefix`. */
export function linkIn(mail: DevMail, prefix: string): string {
  const link = mail.text.split(/\s+/).find((part) => part.startsWith(prefix));
  if (!link) throw new Error(`No link starting with ${prefix} in "${mail.subject}"`);
  return link;
}
