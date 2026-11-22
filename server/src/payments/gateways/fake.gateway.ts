import {
  CheckoutRequest,
  CheckoutResult,
  InvalidSignatureError,
  PaidNotice,
  PaymentGateway,
} from './payment-gateway';
import { payosSign, payosVerify, readPayosWebhook } from './payos-signature';

/**
 * Local/e2e stand-in for PayOS (which has no sandbox). It speaks the PayOS
 * webhook format and signature with a dev-only key, so a simulated payment
 * goes through exactly the same verification and processing as a real one.
 * Never enabled in production (see payments.module.ts).
 */
export class FakeGateway implements PaymentGateway {
  readonly name = 'FAKE' as const;

  constructor(private readonly checksumKey: string) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    return {
      checkoutUrl: null,
      // Not a payable VietQR: scanning it in a bank app does nothing.
      qrCode: `VANKINH-DEMO|${req.description}|${req.amountVnd}|KHONG-PHAI-MA-THANH-TOAN-THAT`,
      gatewayLinkId: `fake-${req.orderCode}`,
    };
  }

  verifyWebhook(body: unknown): PaidNotice | null {
    const hook = readPayosWebhook(body);
    if (!hook || !payosVerify(hook.data, hook.signature, this.checksumKey)) {
      throw new InvalidSignatureError();
    }
    const d = hook.data;
    if (!hook.success || d.code !== '00') return null;
    return {
      orderCode: Number(d.orderCode),
      amountVnd: Number(d.amount),
      reference: typeof d.reference === 'string' && d.reference ? d.reference : null,
    };
  }

  /** The fake gateway only learns about payments through (simulated) webhooks. */
  async fetchPaid(): Promise<PaidNotice | null> {
    return null;
  }

  async cancel(): Promise<void> {}

  /** Builds a signed PayOS-style webhook body, as the bank would trigger it. */
  buildPaidWebhook(orderCode: number, amountVnd: number, reference: string) {
    const data = {
      orderCode,
      amount: amountVnd,
      description: `VK${orderCode}`,
      accountNumber: '0000000000',
      reference,
      transactionDateTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      currency: 'VND',
      paymentLinkId: `fake-${orderCode}`,
      code: '00',
      desc: 'Thành công',
      counterAccountBankId: '',
      counterAccountBankName: '',
      counterAccountName: null,
      counterAccountNumber: null,
      virtualAccountName: '',
      virtualAccountNumber: '',
    };
    return { code: '00', desc: 'success', success: true, data, signature: payosSign(data, this.checksumKey) };
  }
}
