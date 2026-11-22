'use client';

import { getApiBase } from '@/lib/api';

/**
 * Multipart upload with progress (fetch cannot report upload progress).
 * Sends the HTTP-only auth cookie like apiRequest and throws the API's
 * Vietnamese message on failure.
 */
export function uploadWithProgress<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${getApiBase()}${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // empty or non-JSON body
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      const message = (data as { message?: string | string[] } | null)?.message;
      reject(new Error(Array.isArray(message) ? message.join(', ') : message || `Lỗi tải lên (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải lên. Vui lòng thử lại.'));
    xhr.send(body);
  });
}
