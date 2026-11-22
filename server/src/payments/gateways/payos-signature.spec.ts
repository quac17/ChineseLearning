import * as crypto from 'crypto';
import { FakeGateway } from './fake.gateway';
import { InvalidSignatureError } from './payment-gateway';
import { payosCheckoutSignature, payosDataString, payosSign, payosVerify } from './payos-signature';
import { PayosGateway } from './payos.gateway';

const KEY = 'test-checksum-key';
const hmac = (s: string) => crypto.createHmac('sha256', KEY).update(s).digest('hex');

describe('payosDataString', () => {
  it('sorts keys alphabetically and joins key=value with &', () => {
    expect(payosDataString({ orderCode: 5, amount: 2000, description: 'VK5' })).toBe(
      'amount=2000&description=VK5&orderCode=5',
    );
  });

  it('drops undefined keys and writes null as an empty value', () => {
    expect(payosDataString({ b: null, a: undefined, c: 'null', d: 'x' })).toBe('b=&c=&d=x');
  });

  it('writes arrays as JSON with each element sorted by key', () => {
    expect(payosDataString({ items: [{ price: 1, name: 'A' }] })).toBe('items=[{"name":"A","price":1}]');
  });
});

describe('payosCheckoutSignature', () => {
  it('signs exactly amount, cancelUrl, description, orderCode, returnUrl', () => {
    const sig = payosCheckoutSignature(
      { amount: 499000, cancelUrl: 'https://a/c', description: 'VK1000001', orderCode: 1000001, returnUrl: 'https://a/r' },
      KEY,
    );
    expect(sig).toBe(
      hmac('amount=499000&cancelUrl=https://a/c&description=VK1000001&orderCode=1000001&returnUrl=https://a/r'),
    );
  });
});

describe('payosVerify', () => {
  const data = { orderCode: 1000001, amount: 499000, reference: 'FT123', code: '00', counterAccountName: null };

  it('accepts the right signature', () => {
    expect(payosVerify(data, payosSign(data, KEY), KEY)).toBe(true);
  });

  it('rejects a tampered amount, a wrong key, and malformed signatures', () => {
    const sig = payosSign(data, KEY);
    expect(payosVerify({ ...data, amount: 1 }, sig, KEY)).toBe(false);
    expect(payosVerify(data, sig, 'other-key')).toBe(false);
    expect(payosVerify(data, 'not-hex', KEY)).toBe(false);
    expect(payosVerify(data, undefined, KEY)).toBe(false);
    expect(payosVerify(data, sig.slice(0, 32), KEY)).toBe(false);
  });
});

describe('PayosGateway.verifyWebhook', () => {
  const gw = new PayosGateway({ clientId: 'c', apiKey: 'a', checksumKey: KEY });
  const fake = new FakeGateway(KEY); // same format, so it can build PayOS-shaped bodies

  it('returns the paid notice for a signed successful payment', () => {
    const body = fake.buildPaidWebhook(1000001, 499000, 'FT123');
    expect(gw.verifyWebhook(body)).toEqual({ orderCode: 1000001, amountVnd: 499000, reference: 'FT123' });
  });

  it('returns null for a signed webhook that is not a successful payment', () => {
    const body = fake.buildPaidWebhook(1000001, 499000, 'FT123');
    const data = { ...body.data, code: '01', desc: 'Thất bại' };
    expect(gw.verifyWebhook({ ...body, code: '01', success: false, data, signature: payosSign(data, KEY) })).toBeNull();
  });

  it('throws InvalidSignatureError for a bad or missing signature', () => {
    const body = fake.buildPaidWebhook(1000001, 499000, 'FT123');
    expect(() => gw.verifyWebhook({ ...body, data: { ...body.data, amount: 1 } })).toThrow(InvalidSignatureError);
    expect(() => gw.verifyWebhook({ ...body, signature: undefined })).toThrow(InvalidSignatureError);
    expect(() => gw.verifyWebhook({})).toThrow(InvalidSignatureError);
    expect(() => gw.verifyWebhook(null)).toThrow(InvalidSignatureError);
  });
});

describe('FakeGateway', () => {
  it('never produces a payable VietQR and only verifies with its own key', async () => {
    const gw = new FakeGateway(KEY);
    const link = await gw.createCheckout({
      orderId: 'o',
      orderCode: 1,
      amountVnd: 2000,
      description: 'VK1',
      itemName: 'x',
      expiresAt: new Date(),
      returnUrl: 'r',
      cancelUrl: 'c',
    });
    expect(link.qrCode).toContain('KHONG-PHAI-MA-THANH-TOAN-THAT');
    const body = new FakeGateway('another-key').buildPaidWebhook(1, 2000, 'R');
    expect(() => gw.verifyWebhook(body)).toThrow(InvalidSignatureError);
  });
});
