import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Test-only: the console mailer's outbox, so e2e can follow the link in a
 * mail. Public on purpose (Playwright has no special credentials), which is
 * why it answers 404 unless MAIL_TRANSPORT=console and MAIL_DEV_OUTBOX=true;
 * mail.module.ts refuses both in production.
 */
@Controller('dev/mails')
export class DevMailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  list(@Query('to') to?: string) {
    const mails = this.mail.outbox(to ?? '');
    if (!mails) throw new NotFoundException();
    if (!to) throw new BadRequestException('Thiếu địa chỉ email.');
    return mails;
  }
}
