import { APIRequestContext, Page, expect, request } from '@playwright/test';
import * as path from 'path';
import { API_URL, AUTH_DIR } from '../env';

/** Seed accounts from server/db/sql/03_seed_data.sql (demo-only passwords, see README). */
export const ACCOUNTS = {
  admin: { email: 'admin@vankinh.vn', password: 'Admin@123', fullName: 'Quản trị viên Vân Kính' },
  teacher: { email: 'teacher@vankinh.vn', password: 'Teacher@123', fullName: 'Cô Ngân (Giáo viên)' },
  studentA: { email: 'studentA@vankinh.vn', password: 'Student@123', fullName: 'Nguyễn Văn A (Học sinh)' },
  studentB: { email: 'studentB@vankinh.vn', password: 'Student@123', fullName: 'Trần Thị B (Học sinh)' },
} as const;

export type Role = keyof typeof ACCOUNTS;

/** Seed ids the specs rely on. */
export const SEED = {
  hsk1: 'course-hsk1',
  hsk1FreeLesson: 'lesson-hsk1-b1',
  hsk1PaidLesson: 'lesson-hsk1-b2',
  studentBId: 'user-student-b',
} as const;

export const storageStateFor = (role: Role) => path.join(AUTH_DIR, `${role}.json`);

/** An API client already logged in as `role` (cookie from the setup project). */
export function apiAs(role: Role): Promise<APIRequestContext> {
  return request.newContext({ baseURL: `${API_URL}/`, storageState: storageStateFor(role) });
}

/**
 * An API client with no cookie. The empty storageState is explicit: inside a
 * `test.use({ storageState })` block, request.newContext() would otherwise
 * inherit that role's cookie.
 */
export function anonymousApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: `${API_URL}/`, storageState: { cookies: [], origins: [] } });
}

/** Logs in through the real form. Use only in specs about the login UI itself. */
export async function loginThroughForm(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

/** Opens the account menu in the site header and checks who is logged in. */
export async function expectLoggedInAs(page: Page, fullName: string) {
  await expect(page.getByRole('button', { name: `Tài khoản của ${fullName}` })).toBeVisible();
}
