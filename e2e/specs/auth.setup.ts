import { expect, test as setup } from '@playwright/test';
import { API_URL } from '../env';
import { ACCOUNTS, Role, storageStateFor } from '../fixtures/auth';

// Log in once per seed account through the API and save the cookie, so specs
// start already logged in instead of repeating the login form.
for (const role of Object.keys(ACCOUNTS) as Role[]) {
  setup(`log in as ${role}`, async ({ request }) => {
    const { email, password } = ACCOUNTS[role];
    const res = await request.post(`${API_URL}/auth/login`, { data: { email, password } });
    expect(res.status(), await res.text()).toBe(201);
    await request.storageState({ path: storageStateFor(role) });
  });
}
