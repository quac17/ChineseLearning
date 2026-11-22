import { Body, Controller, Get, Headers, HttpCode, Post, Put, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ReminderSettingsDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';
import { isValidCronSecret } from './review-reminder';

@Controller('reminders')
export class RemindersController {
  private readonly cronSecret: string | undefined;

  constructor(
    private readonly reminders: RemindersService,
    config: ConfigService,
  ) {
    this.cronSecret = config.get<string>('REMINDER_CRON_SECRET') || undefined;
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  settings(@CurrentUser() user: AuthUser) {
    return this.reminders.settings(user.id);
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: AuthUser, @Body() dto: ReminderSettingsDto) {
    return this.reminders.setEnabled(user.id, dto.enabled);
  }

  /**
   * Public: the HMAC signature in the mailed link is the credential. Takes the
   * query string so mail clients' one-click POST (RFC 8058) works as well as
   * the /unsubscribe page. Only ever turns the reminder off.
   */
  @Post('unsubscribe')
  @HttpCode(200)
  unsubscribe(@Query('u') userId?: string, @Query('s') signature?: string) {
    return this.reminders.unsubscribe(userId ?? '', signature ?? '');
  }

  /**
   * Cloud Scheduler calls this once a day with the X-Cron-Secret header
   * (REMINDER_CRON_SECRET). No user session: the shared secret is the guard,
   * and an unset secret refuses every call.
   */
  @Post('run')
  @HttpCode(200)
  run(@Headers('x-cron-secret') secret?: string) {
    if (!isValidCronSecret(this.cronSecret, secret)) {
      throw new UnauthorizedException('Thiếu hoặc sai mã bí mật của lịch chạy.');
    }
    return this.reminders.run();
  }
}
