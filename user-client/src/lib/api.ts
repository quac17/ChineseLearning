const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api';

export function getApiBase(): string {
  return API_BASE;
}

/**
 * URL cho video stream và download tài liệu.
 * Trình duyệt tự động đính kèm HTTP-only cookie xác thực khi gọi API.
 */
export function buildMediaUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

/** A non-2xx API response. `status` lets pages tell "not found" from a server failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_BASE}${cleanPath}`, {
    ...options,
    headers,
    credentials: 'include', // Bắt buộc để gửi & nhận HTTP-only cookie duy trì đăng nhập
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `Lỗi kết nối (${response.status})`;
    try {
      const errData = await response.json();
      if (Array.isArray(errData?.message)) {
        message = errData.message.join(', ');
      } else if (typeof errData?.message === 'string') {
        message = errData.message;
      }
    } catch {
      // keep default error
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
