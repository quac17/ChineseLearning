import { Logger } from '@nestjs/common';
import { Mailer, MailMessage, OutboxMail } from './mailer';

/** How many mails the dev outbox keeps (oldest dropped first). */
export const OUTBOX_SIZE = 200;

/**
 * Local and e2e backend: logs each mail instead of sending it. With an outbox
 * (MAIL_DEV_OUTBOX=true, never in production) it also keeps the last mails in
 * memory so e2e can read the links through GET /api/dev/mails.
 */
export class ConsoleMailer implements Mailer {
  readonly name = 'console' as const;
  private readonly logger = new Logger('Mail');
  private readonly outbox: OutboxMail[] = [];

  constructor(private readonly keepOutbox: boolean) {}

  get hasOutbox(): boolean {
    return this.keepOutbox;
  }

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`[console] To: ${message.to} | ${message.subject}\n${message.text}`);
    if (!this.keepOutbox) return;
    this.outbox.push({ ...message, sentAt: new Date().toISOString() });
    if (this.outbox.length > OUTBOX_SIZE) this.outbox.shift();
  }

  /** Mails sent to `to` (case-insensitive), newest first. */
  mailsTo(to: string): OutboxMail[] {
    const wanted = to.trim().toLowerCase();
    return this.outbox.filter((m) => m.to.toLowerCase() === wanted).reverse();
  }
}
