import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoursesModule } from '../courses/courses.module';
import { FakeGateway } from './gateways/fake.gateway';
import { PAYMENT_GATEWAY, PaymentGateway } from './gateways/payment-gateway';
import { PayosGateway } from './gateways/payos.gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * PAYMENT_GATEWAY=payos uses PayOS (needs PAYOS_* keys; real money, PayOS has
 * no sandbox). Anything else uses the fake gateway, which is refused in
 * production so a misconfigured server never "sells" courses for free.
 */
function gatewayFactory(config: ConfigService): PaymentGateway {
  if (config.get<string>('FEATURE_PAYOS_ENABLED') !== 'true') {
    new Logger('Payments').log('Tính năng thanh toán PayOS đang tạm ẩn (FEATURE_PAYOS_ENABLED != true).');
    return new FakeGateway(config.get<string>('FAKE_PAYMENT_CHECKSUM_KEY') || 'chinese-learner-fake-checksum-key');
  }
  const choice = (config.get<string>('PAYMENT_GATEWAY') || 'fake').toLowerCase();
  if (choice === 'payos') {
    const clientId = config.get<string>('PAYOS_CLIENT_ID');
    const apiKey = config.get<string>('PAYOS_API_KEY');
    const checksumKey = config.get<string>('PAYOS_CHECKSUM_KEY');
    if (!clientId || !apiKey || !checksumKey) {
      throw new Error('PAYMENT_GATEWAY=payos cần PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY.');
    }
    return new PayosGateway({ clientId, apiKey, checksumKey });
  }
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('Không được dùng cổng thanh toán giả lập ở production. Đặt PAYMENT_GATEWAY=payos.');
  }
  new Logger('Payments').warn('Đang dùng cổng thanh toán GIẢ LẬP (PAYMENT_GATEWAY=fake).');
  return new FakeGateway(config.get<string>('FAKE_PAYMENT_CHECKSUM_KEY') || 'chinese-learner-fake-checksum-key');
}

@Module({
  imports: [CoursesModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_GATEWAY, useFactory: gatewayFactory, inject: [ConfigService] },
  ],
})
export class PaymentsModule {}
