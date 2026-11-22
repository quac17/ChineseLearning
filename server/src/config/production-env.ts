/**
 * Settings a production server must not start without (NODE_ENV=production).
 * Checked in main.ts before Nest boots, so a bad Cloud Run revision fails its
 * health check instead of serving with dev defaults (dev JWT secret, insecure
 * cookie, a CORS origin of `*`). PayOS keys are checked by PaymentsModule and
 * the bucket name by StorageService.
 */

type Env = Record<string, string | undefined>;

export interface EnvReport {
  errors: string[];
  warnings: string[];
}

/** Placeholders copied from .env.example must never reach production. */
const KNOWN_DEV_SECRETS = new Set(['super_secret_jwt_key_change_in_production', 'dev_jwt_secret']);

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.pathname === '/' && !value.endsWith('/');
  } catch {
    return false;
  }
}

export function checkProductionEnv(env: Env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (env.NODE_ENV !== 'production') return { errors, warnings };

  const jwt = env.JWT_SECRET ?? '';
  if (!jwt || KNOWN_DEV_SECRETS.has(jwt) || jwt.length < 32) {
    errors.push('JWT_SECRET must be a random string of at least 32 characters (not the .env.example value).');
  }

  if (!env.DATABASE_URL && !(env.POSTGRES_HOST && env.POSTGRES_PASSWORD)) {
    errors.push('DATABASE_URL (or POSTGRES_HOST + POSTGRES_PASSWORD) is required.');
  }

  if (env.COOKIE_SECURE !== 'true') {
    errors.push('COOKIE_SECURE must be "true": the login cookie only travels over HTTPS.');
  }
  const sameSite = (env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    errors.push('COOKIE_SAME_SITE must be lax, strict or none.');
  }

  const origins = (env.CORS_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    errors.push('CORS_ORIGIN is required: the https origin of the web app, e.g. https://vankinh.vn.');
  } else if (origins.some((o) => !isHttpsOrigin(o))) {
    errors.push('CORS_ORIGIN must list https origins without a trailing slash; "*" is not allowed with the login cookie.');
  }

  if (!env.APP_URL || !isHttpsOrigin(env.APP_URL)) {
    errors.push('APP_URL must be the https origin of the web app (PayOS returns learners there).');
  }

  if ((env.PAYMENT_GATEWAY || 'fake') !== 'payos') {
    errors.push('PAYMENT_GATEWAY must be "payos" in production (the fake gateway is for local and e2e only).');
  }

  if ((env.STORAGE_BACKEND || 'local') !== 'gcs') {
    warnings.push(
      'STORAGE_BACKEND is not "gcs": uploads go to UPLOAD_DIR, which Cloud Run wipes on every restart unless a volume is mounted there.',
    );
  }

  if (!env.MAIL_TRANSPORT) {
    warnings.push('MAIL_TRANSPORT is not set: emails (password reset) cannot be sent.');
  }

  return { errors, warnings };
}

/** Throws with every problem at once, so one deploy shows the whole list. */
export function assertProductionEnv(env: Env = process.env): void {
  const { errors, warnings } = checkProductionEnv(env);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length) {
    throw new Error(`Production configuration is incomplete:\n- ${errors.join('\n- ')}`);
  }
}
