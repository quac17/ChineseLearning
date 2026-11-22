/**
 * What PaymentsService needs from a payment gateway. Adding VNPay/MoMo later
 * means a new file in this folder; the service never imports a gateway SDK.
 */

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type GatewayName = 'PAYOS' | 'FAKE';

export interface CheckoutRequest {
  orderId: string;
  orderCode: number;
  amountVnd: number;
  /** Shown in the bank transfer. PayOS limits it to 9 characters. */
  description: string;
  itemName: string;
  expiresAt: Date;
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string | null;
  /** VietQR EMV string; the page draws it as a QR code. */
  qrCode: string;
  gatewayLinkId: string | null;
}

/** A payment the gateway says has been received for an order. */
export interface PaidNotice {
  orderCode: number;
  amountVnd: number;
  /** Gateway's own transaction reference, used as the idempotency key. */
  reference: string | null;
}

export interface PaymentGateway {
  readonly name: GatewayName;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /**
   * Checks a webhook body. Returns the paid notice, `null` for a valid
   * webhook that is not a successful payment, or throws if the signature is
   * invalid.
   */
  verifyWebhook(body: unknown): PaidNotice | null;
  /** Asks the gateway whether the order has been paid (reconciliation). */
  fetchPaid(orderCode: number): Promise<PaidNotice | null>;
  /** Cancels the payment link so it cannot be paid any more (best effort). */
  cancel(orderCode: number): Promise<void>;
}

export class InvalidSignatureError extends Error {
  constructor() {
    super('Chữ ký webhook không hợp lệ.');
  }
}
