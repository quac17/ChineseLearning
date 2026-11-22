/**
 * Logging out every session when the password changes (#31). JWTs are
 * stateless, so the server compares the token's `iat` (whole seconds) with
 * users.password_changed_at (milliseconds): a token is valid only if it was
 * issued in or after the second of the change. The token issued right after
 * a change in the same request therefore stays valid; a token issued earlier
 * in that same second also would (at most ~1s of skew, accepted).
 */
export function issuedAfterPasswordChange(iatSeconds: number | undefined, passwordChangedAt: Date | string | null): boolean {
  if (!passwordChangedAt) return true;
  if (typeof iatSeconds !== 'number') return false;
  return (iatSeconds + 1) * 1000 > new Date(passwordChangedAt).getTime();
}

export const SESSION_ENDED_MESSAGE = 'Mật khẩu đã được đổi. Vui lòng đăng nhập lại.';
