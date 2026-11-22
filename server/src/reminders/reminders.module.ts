import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from '../mail/mail.module';
import { RemindersController } from './reminders.controller';
import { RemindersCron } from './reminders.cron';
import { RemindersService } from './reminders.service';

@Module({
  imports: [MailModule, ScheduleModule.forRoot()],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersCron],
})
export class RemindersModule {}
