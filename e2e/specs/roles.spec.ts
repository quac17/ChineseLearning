import { expect, test } from '@playwright/test';
import { API_URL } from '../env';
import { anonymousApi, apiAs, storageStateFor } from '../fixtures/auth';
import { uniq } from '../fixtures/data';

test.describe('role guards on the API', () => {
  test('only admin lists users', async () => {
    expect((await (await anonymousApi()).get('users')).status()).toBe(401);
    expect((await (await apiAs('studentB')).get('users')).status()).toBe(403);
    expect((await (await apiAs('teacher')).get('users')).status()).toBe(403);
    expect((await (await apiAs('admin')).get('users')).status()).toBe(200);
  });

  test('a student cannot create a course or grant access', async () => {
    const student = await apiAs('studentB');
    const course = await student.post('courses', { data: { title: 'Không được tạo', module: 'hsk' } });
    expect(course.status()).toBe(403);
    const grant = await student.post('enrollments/access', {
      data: { courseId: 'course-hsk1', studentId: 'user-student-b', canView: true },
    });
    expect(grant.status()).toBe(403);
  });

  test('a teacher only manages their own courses', async () => {
    const admin = await apiAs('admin');
    const otherTeacherEmail = `gv-${uniq()}@e2e.test`;
    const created = await admin.post('users', {
      data: { email: otherTeacherEmail, password: 'Matkhau@123', fullName: 'Giáo viên khác', role: 'TEACHER' },
    });
    expect(created.status(), await created.text()).toBe(201);

    const other = await anonymousApi();
    expect((await other.post('auth/login', { data: { email: otherTeacherEmail, password: 'Matkhau@123' } })).ok()).toBeTruthy();
    const edit = await other.patch('courses/course-hsk1', { data: { title: 'Sửa trộm' } });
    expect(edit.status()).toBe(403);
  });
});

test.describe('role areas in the UI', () => {
  test.use({ storageState: storageStateFor('studentB') });

  test('a student sees the admin-only notice on /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /chỉ dành cho Quản trị viên/ })).toBeVisible();
  });
});

test('admin locks a user, who can then no longer log in', async ({ request }) => {
  const admin = await apiAs('admin');
  const email = `khoa-${uniq()}@e2e.test`;
  const password = 'Matkhau@123';
  const created = await admin.post('users', {
    data: { email, password, fullName: 'Học viên bị khoá', role: 'STUDENT' },
  });
  expect(created.status(), await created.text()).toBe(201);
  const { id } = await created.json();

  expect((await request.post(`${API_URL}/auth/login`, { data: { email, password } })).ok()).toBeTruthy();

  const lock = await admin.patch(`users/${id}`, { data: { isActive: false } });
  expect(lock.ok(), await lock.text()).toBeTruthy();

  const denied = await request.post(`${API_URL}/auth/login`, { data: { email, password } });
  expect(denied.status()).toBe(401);
  expect((await denied.json()).message).toBe('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
});
