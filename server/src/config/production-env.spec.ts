import { assertProductionEnv, checkProductionEnv } from './production-env';

const good = {
  NODE_ENV: 'production',
  JWT_SECRET: 'q'.repeat(40),
  DATABASE_URL: 'postgresql://vankinh:pw@localhost/vankinh_db?host=/cloudsql/x',
  COOKIE_SECURE: 'true',
  COOKIE_SAME_SITE: 'lax',
  CORS_ORIGIN: 'https://vankinh.vn',
  APP_URL: 'https://vankinh.vn',
  PAYMENT_GATEWAY: 'payos',
  STORAGE_BACKEND: 'gcs',
  MAIL_TRANSPORT: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  MAIL_FROM: 'Vân Kính <no-reply@example.com>',
  TRUST_PROXY: '1',
  REMINDER_CRON_SECRET: 'r'.repeat(40),
};

describe('production configuration', () => {
  it('a complete production env passes without warnings', () => {
    expect(checkProductionEnv(good)).toEqual({ errors: [], warnings: [] });
  });

  it('is not checked outside production (local and e2e keep their defaults)', () => {
    expect(checkProductionEnv({ NODE_ENV: 'development' })).toEqual({ errors: [], warnings: [] });
    expect(checkProductionEnv({})).toEqual({ errors: [], warnings: [] });
  });

  it.each([
    ['the .env.example JWT secret', { JWT_SECRET: 'super_secret_jwt_key_change_in_production' }, /JWT_SECRET/],
    ['a short JWT secret', { JWT_SECRET: 'short' }, /JWT_SECRET/],
    ['no database', { DATABASE_URL: undefined }, /DATABASE_URL/],
    ['an insecure cookie', { COOKIE_SECURE: 'false' }, /COOKIE_SECURE/],
    ['an unknown SameSite', { COOKIE_SAME_SITE: 'loose' }, /COOKIE_SAME_SITE/],
    ['CORS "*"', { CORS_ORIGIN: '*' }, /CORS_ORIGIN/],
    ['CORS over http', { CORS_ORIGIN: 'http://vankinh.vn' }, /CORS_ORIGIN/],
    ['CORS with a trailing slash', { CORS_ORIGIN: 'https://vankinh.vn/' }, /CORS_ORIGIN/],
    ['no APP_URL', { APP_URL: undefined }, /APP_URL/],
    ['the fake gateway', { PAYMENT_GATEWAY: 'fake' }, /PAYMENT_GATEWAY/],
    ['no mail transport (console by default)', { MAIL_TRANSPORT: undefined }, /MAIL_TRANSPORT/],
    ['the console mailer', { MAIL_TRANSPORT: 'console' }, /MAIL_TRANSPORT/],
    ['SMTP without a password', { SMTP_PASS: undefined }, /SMTP_PASS/],
    ['SMTP without a sender', { MAIL_FROM: undefined }, /MAIL_FROM/],
    ['the dev mail outbox', { MAIL_DEV_OUTBOX: 'true' }, /MAIL_DEV_OUTBOX/],
  ])('refuses %s', (_, patch, message) => {
    const { errors } = checkProductionEnv({ ...good, ...patch });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(message);
  });

  it('accepts several https origins', () => {
    expect(checkProductionEnv({ ...good, CORS_ORIGIN: 'https://vankinh.vn, https://www.vankinh.vn' }).errors).toEqual([]);
  });

  it('only warns about local storage, a missing TRUST_PROXY and a missing reminder secret', () => {
    const { errors, warnings } = checkProductionEnv({
      ...good,
      STORAGE_BACKEND: undefined,
      TRUST_PROXY: undefined,
      REMINDER_CRON_SECRET: undefined,
    });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(3);
  });

  it('throws with every problem listed at once', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => assertProductionEnv({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET[\s\S]*COOKIE_SECURE[\s\S]*PAYMENT_GATEWAY/);
  });
});
