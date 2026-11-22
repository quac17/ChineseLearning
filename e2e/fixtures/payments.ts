import { APIRequestContext, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { API_URL, FAKE_CHECKSUM_KEY } from '../env';
import { uniq } from './data';

/**
 * PayOS webhook signature, written independently of the server code so a
 * regression on either side shows up: HMAC-SHA256 hex over key=value pairs
 * sorted by key, null → "".
 */
export function signedWebhook(orderCode: number, amount: number, reference: string, code = '00') {
  const data: Record<string, string | number | null> = {
    orderCode,
    amount,
    description: `VK${orderCode}`,
    accountNumber: '0000000000',
    reference,
    transactionDateTime: '2026-11-22 10:00:00',
    currency: 'VND',
    paymentLinkId: `e2e-${orderCode}`,
    code,
    desc: code === '00' ? 'Thành công' : 'Thất bại',
    counterAccountName: null,
  };
  const str = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k] ?? ''}`)
    .join('&');
  const signature = crypto.createHmac('sha256', FAKE_CHECKSUM_KEY).update(str).digest('hex');
  return { code, desc: 'success', success: code === '00', data, signature };
}

export async function postWebhook(api: APIRequestContext, body: unknown) {
  return api.post(`${API_URL}/payments/webhook/payos`, { data: body });
}

/** A brand-new student (logged in on `api`), so purchases never leak into other specs. */
export async function newStudent(api: APIRequestContext) {
  const email = `mua-${uniq()}@e2e.test`;
  const res = await api.post(`${API_URL}/auth/register`, {
    data: { fullName: 'Học viên mua khoá', email, password: 'Matkhau@123' },
  });
  expect(res.status(), await res.text()).toBe(201);
  const { user } = await res.json();
  return { id: user.id as string, email };
}

export async function checkout(api: APIRequestContext, courseId: string) {
  const res = await api.post(`${API_URL}/payments/checkout`, { data: { courseId } });
  return res;
}

/** "VK-1000003" → 1000003 */
export const orderCodeOf = (order: { code: string }) => Number(order.code.replace('VK-', ''));
