'use client';

import { apiRequest, getApiBase } from '@/lib/api';
import type { VideoUploadTicket } from '@/lib/types';

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

/** PUT a file to a signed storage URL. No cookie: the URL itself is the permission. */
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Kho lưu trữ từ chối tệp video (${xhr.status}). Vui lòng thử lại.`));
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải video lên. Vui lòng thử lại.'));
    xhr.send(file);
  });
}

export interface VideoLessonFields {
  title: string;
  description: string;
  durationMinutes: number | null;
  isFree: boolean;
  /** Only sent when the course has sections; '' = no section. */
  sectionId?: string;
}

/**
 * Uploads a lesson video and creates (or, with `lessonId`, replaces) the
 * lesson. The API decides how: on the bucket backend the browser PUTs the
 * file straight to a short-lived signed URL and then confirms; on the local
 * backend it is the usual multipart upload.
 */
export async function uploadLessonVideo<T>(opts: {
  courseId: string;
  lessonId?: string;
  file: File;
  fields: VideoLessonFields;
  onProgress: (percent: number) => void;
}): Promise<T> {
  const { courseId, lessonId, file, fields, onProgress } = opts;
  const ticket = await apiRequest<VideoUploadTicket>('/lessons/upload-url', {
    method: 'POST',
    body: JSON.stringify({ courseId, fileName: file.name, contentType: file.type, fileSize: file.size }),
  });

  if (ticket.direct) {
    await putWithProgress(ticket.uploadUrl, file, ticket.headers, onProgress);
    const body = JSON.stringify({
      ...(lessonId ? {} : { courseId }),
      ...fields,
      storageKey: ticket.storageKey,
      uploadToken: ticket.uploadToken,
      originalFileName: file.name,
    });
    return lessonId
      ? apiRequest<T>(`/lessons/${lessonId}/upload/confirm`, { method: 'PATCH', body })
      : apiRequest<T>('/lessons/upload/confirm', { method: 'POST', body });
  }

  const fd = new FormData();
  if (!lessonId) fd.append('courseId', courseId);
  fd.append('title', fields.title);
  fd.append('description', fields.description);
  fd.append('durationMinutes', fields.durationMinutes === null ? '' : String(fields.durationMinutes));
  fd.append('isFree', String(fields.isFree));
  if (fields.sectionId !== undefined) fd.append('sectionId', fields.sectionId);
  fd.append('file', file);
  return uploadWithProgress<T>(
    lessonId ? `/lessons/${lessonId}/upload` : '/lessons/upload',
    lessonId ? 'PATCH' : 'POST',
    fd,
    onProgress,
  );
}
