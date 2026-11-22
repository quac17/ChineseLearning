import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConsoleMailer } from './console.mailer';
import { MAILER, Mailer, MailMessage, OutboxMail } from './mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  constructor(@Inject(MAILER) private readonly mailer: Mailer) {}

  /** Sends one mail. Throws if the backend refuses it; callers decide whether that matters. */
  async send(message: MailMessage): Promise<void> {
    try {
      await this.mailer.send(message);
    } catch (err) {
      // Never log the body: it can hold a reset link.
      this.logger.error(`Gửi email thất bại (${this.mailer.name}) tới ${message.to}: ${(err as Error).message}`);
      throw err;
    }
  }

  /** The dev outbox, or null when it is off (smtp, or MAIL_DEV_OUTBOX not set). */
  outbox(to: string): OutboxMail[] | null {
    if (this.mailer instanceof ConsoleMailer && this.mailer.hasOutbox) return this.mailer.mailsTo(to);
    return null;
  }
}
