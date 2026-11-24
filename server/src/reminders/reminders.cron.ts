import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { RemindersService } from './reminders.service';

export const REMINDER_JOB = 'review-reminders';
export const DEFAULT_REMINDER_CRON = '0 19 * * *';

/**
 * In-process schedule, off unless REMINDER_CRON_ENABLED=true. Meant for a
 * single always-on server (a VM, local). On Cloud Run, which scales to zero
 * and may run several instances, leave it off and let Cloud Scheduler call
 * POST /api/reminders/run instead (tmp/HUONG-DAN-DEPLOY-GCP.md). Running
 * both is safe: a learner's day is claimed once.
 */
@Injectable()
export class RemindersCron implements OnApplicationBootstrap {
  private readonly logger = new Logger('Reminders');

  constructor(
    private readonly reminders: RemindersService,
    private readonly registry: SchedulerRegistry,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('FEATURE_MAIL_ENABLED') !== 'true') return;
    if (this.config.get<string>('REMINDER_CRON_ENABLED') !== 'true') return;
    const expression = this.config.get<string>('REMINDER_CRON') || DEFAULT_REMINDER_CRON;
    const job = new CronJob(
      expression,
      () => {
        this.reminders.run().catch((err: Error) => this.logger.error(`Lịch nhắc ôn tập lỗi: ${err.message}`));
      },
      null,
      false,
      'Asia/Ho_Chi_Minh',
    );
    this.registry.addCronJob(REMINDER_JOB, job);
    job.start();
    this.logger.log(`Đã bật lịch nhắc ôn tập "${expression}" (giờ Việt Nam).`);
  }
}
