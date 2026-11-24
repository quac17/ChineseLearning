import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleMailer } from './console.mailer';
import { DevMailController } from './dev-mail.controller';
import { MailService } from './mail.service';
import { MAILER, Mailer } from './mailer';
import { SmtpMailer } from './smtp.mailer';

type Env = Pick<ConfigService, 'get'>;

/**
 * MAIL_TRANSPORT=smtp sends real mail (needs SMTP_* and MAIL_FROM). Anything
 * else uses the console mailer, which is refused in production so a
 * misconfigured server never silently drops reset links, the same way the
 * fake payment gateway is refused.
 */
export function mailerFactory(config: Env): Mailer {
  if (config.get<string>('FEATURE_MAIL_ENABLED') !== 'true') {
    new Logger('Mail').log('Tính năng gửi email đang tạm ẩn (FEATURE_MAIL_ENABLED != true).');
    return new ConsoleMailer(false);
  }
  const choice = (config.get<string>('MAIL_TRANSPORT') || 'console').toLowerCase();
  if (choice === 'smtp') {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const from = config.get<string>('MAIL_FROM');
    if (!host || !user || !pass || !from) {
      throw new Error('MAIL_TRANSPORT=smtp cần SMTP_HOST, SMTP_USER, SMTP_PASS và MAIL_FROM.');
    }
    const port = Number(config.get<string>('SMTP_PORT')) || 587;
    return new SmtpMailer({ host, port, secure: port === 465, user, pass, from });
  }
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('Không được dùng email giả lập ở production. Đặt MAIL_TRANSPORT=smtp.');
  }
  const outbox = config.get<string>('MAIL_DEV_OUTBOX') === 'true';
  new Logger('Mail').warn(
    `Đang dùng email GIẢ LẬP (MAIL_TRANSPORT=console): thư chỉ được in ra log${outbox ? ' và giữ ở /api/dev/mails' : ''}.`,
  );
  return new ConsoleMailer(outbox);
}

@Module({
  controllers: [DevMailController],
  providers: [MailService, { provide: MAILER, useFactory: mailerFactory, inject: [ConfigService] }],
  exports: [MailService],
})
export class MailModule {}
