import * as crypto from 'crypto';

/**
 * PayOS payment-request signatures (https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/):
 * HMAC-SHA256 (hex) with the checksum key over "key=value&…" with keys sorted
 * alphabetically. undefined keys are dropped; null/undefined values become "";
 * arrays are JSON with each element's keys sorted. Payouts use a different
 * scheme; this is only for payment requests and their webhooks.
 */
export function payosDataString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .sort()
    .map((key) => `${key}=${serialize(data[key])}`)
    .join('&');
}

function serialize(value: unknown): string {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return '';
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((v) => (v && typeof v === 'object' ? sortKeys(v as Record<string, unknown>) : v)));
  }
  return String(value);
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
}

export function payosSign(data: Record<string, unknown>, checksumKey: string): string {
  return crypto.createHmac('sha256', checksumKey).update(payosDataString(data)).digest('hex');
}

/** Signature for "create payment link": only these five fields, in this order. */
export function payosCheckoutSignature(
  fields: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string },
  checksumKey: string,
): string {
  const { amount, cancelUrl, description, orderCode, returnUrl } = fields;
  return payosSign({ amount, cancelUrl, description, orderCode, returnUrl }, checksumKey);
}

/** Constant-time check of a webhook's `data` against its `signature`. */
export function payosVerify(data: Record<string, unknown>, signature: unknown, checksumKey: string): boolean {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(payosSign(data, checksumKey), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Shape check shared by the real and the fake gateway. */
export function readPayosWebhook(body: unknown): {
  success: boolean;
  data: Record<string, unknown>;
  signature: unknown;
} | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return null;
  return { success: b.success === true || b.code === '00', data: b.data as Record<string, unknown>, signature: b.signature };
}
