import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

type Env = Record<string, string | undefined>;

/**
 * Tạm ẩn PayOS và Send Mail mặc định cho tới khi bật lại qua biến môi trường:
 * FEATURE_PAYOS_ENABLED=true / FEATURE_MAIL_ENABLED=true.
 */
export function isPayosEnabled(env: Env = process.env): boolean {
  return env.FEATURE_PAYOS_ENABLED === 'true';
}

export function isMailEnabled(env: Env = process.env): boolean {
  return env.FEATURE_MAIL_ENABLED === 'true';
}

@Injectable()
export class PayosEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isPayosEnabled()) {
      throw new NotFoundException('Tính năng thanh toán tạm thời đang ẩn.');
    }
    return true;
  }
}

@Injectable()
export class MailEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!isMailEnabled()) {
      throw new NotFoundException('Tính năng gửi email tạm thời đang ẩn.');
    }
    return true;
  }
}
