/**
 * Business copy that must be real, not invented: set it in user-client/.env.local.
 * Empty = the line is hidden.
 */
export const SUPPORT_CONTACT = process.env.NEXT_PUBLIC_SUPPORT_CONTACT?.trim() || '';
export const REFUND_POLICY = process.env.NEXT_PUBLIC_REFUND_POLICY?.trim() || '';

/** Tạm ẩn thanh toán PayOS & gửi email (bật lại qua biến NEXT_PUBLIC_FEATURE_* = true). */
export const FEATURE_PAYOS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PAYOS_ENABLED === 'true';
export const FEATURE_MAIL_ENABLED = process.env.NEXT_PUBLIC_FEATURE_MAIL_ENABLED === 'true';
