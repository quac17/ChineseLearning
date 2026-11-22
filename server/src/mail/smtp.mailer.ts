import * as nodemailer from 'nodemailer';
import { Mailer, MailMessage } from './mailer';

export interface SmtpConfig {
  host: string;
  port: number;
  /** TLS from the first byte (port 465). Otherwise STARTTLS is required. */
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Plain SMTP through nodemailer, so the provider stays a configuration choice
 * (#16): Gmail (smtp.gmail.com, app password), SendGrid (smtp.sendgrid.net,
 * user "apikey") or Resend (smtp.resend.com, user "resend").
 */
export class SmtpMailer implements Mailer {
  readonly name = 'smtp' as const;
  private readonly transport: nodemailer.Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: message.headers,
    });
  }
}
