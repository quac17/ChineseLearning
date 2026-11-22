import { BadGatewayException, Logger } from '@nestjs/common';
import {
  CheckoutRequest,
  CheckoutResult,
  InvalidSignatureError,
  PaidNotice,
  PaymentGateway,
} from './payment-gateway';
import { payosCheckoutSignature, payosVerify, readPayosWebhook } from './payos-signature';

export interface PayosConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  baseUrl?: string;
}

/**
 * The only file that talks to PayOS (https://payos.vn/docs/api/).
 * PayOS has no sandbox: every call here is real money.
 */
export class PayosGateway implements PaymentGateway {
  readonly name = 'PAYOS' as const;
  private readonly logger = new Logger(PayosGateway.name);
  private readonly baseUrl: string;

  constructor(private readonly config: PayosConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api-merchant.payos.vn';
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown) {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.config.clientId,
          'x-api-key': this.config.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`PayOS ${method} ${path} failed: ${(err as Error).message}`);
      throw new BadGatewayException('Không kết nối được cổng thanh toán. Vui lòng thử lại sau ít phút.');
    }
    const json = (await res.json().catch(() => null)) as { code?: string; desc?: string; data?: any } | null;
    if (!res.ok || !json || json.code !== '00') {
      // Never log keys or headers; code/desc are safe.
      this.logger.error(`PayOS ${method} ${path} → ${res.status} ${json?.code ?? ''} ${json?.desc ?? ''}`);
      throw new BadGatewayException('Cổng thanh toán từ chối yêu cầu. Vui lòng thử lại sau ít phút.');
    }
    return json.data;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const fields = {
      amount: req.amountVnd,
      cancelUrl: req.cancelUrl,
      description: req.description,
      orderCode: req.orderCode,
      returnUrl: req.returnUrl,
    };
    const data = await this.call('POST', '/v2/payment-requests', {
      ...fields,
      items: [{ name: req.itemName.slice(0, 100), quantity: 1, price: req.amountVnd }],
      expiredAt: Math.floor(req.expiresAt.getTime() / 1000),
      signature: payosCheckoutSignature(fields, this.config.checksumKey),
    });
    if (!data?.qrCode) throw new BadGatewayException('Cổng thanh toán không trả về mã QR.');
    return {
      checkoutUrl: data.checkoutUrl ?? null,
      qrCode: data.qrCode,
      gatewayLinkId: data.paymentLinkId ?? null,
    };
  }

  verifyWebhook(body: unknown): PaidNotice | null {
    const hook = readPayosWebhook(body);
    if (!hook || !payosVerify(hook.data, hook.signature, this.config.checksumKey)) {
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

  async fetchPaid(orderCode: number): Promise<PaidNotice | null> {
    const data = await this.call('GET', `/v2/payment-requests/${orderCode}`);
    if (data?.status !== 'PAID') return null;
    const tx = Array.isArray(data.transactions) ? data.transactions[0] : null;
    return {
      orderCode,
      amountVnd: Number(data.amountPaid ?? data.amount),
      reference: tx?.reference ? String(tx.reference) : null,
    };
  }

  async cancel(orderCode: number): Promise<void> {
    await this.call('POST', `/v2/payment-requests/${orderCode}/cancel`, {
      cancellationReason: 'Đơn hết hạn hoặc bị huỷ trên Vân Kính',
    }).catch(() => undefined);
  }
}
