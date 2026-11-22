/**
 * What the app needs from an email backend. Features build a MailMessage and
 * call MailService.send; they never import nodemailer. Backends live next to
 * this file and are picked by MAIL_TRANSPORT in mail.module.ts.
 */

export const MAILER = Symbol('MAILER');

export type MailerName = 'console' | 'smtp';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}

export interface Mailer {
  readonly name: MailerName;
  send(message: MailMessage): Promise<void>;
}

/** A mail kept by the console mailer for local runs and e2e. */
export interface OutboxMail extends MailMessage {
  sentAt: string;
}
