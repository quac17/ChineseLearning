import * as path from 'path';

/** Only WebVTT: the format the browser <track> element plays. */
export const SUBTITLE_EXTENSION = '.vtt';

/** What browsers and OSes send for a .vtt file (many do not know the type). */
export const SUBTITLE_MIME_TYPES = new Set(['text/vtt', 'text/plain', 'application/octet-stream', '']);

export function subtitleMaxBytes(env: NodeJS.ProcessEnv = process.env): number {
  const kb = Number(env.MAX_SUBTITLE_SIZE_KB);
  return (Number.isFinite(kb) && kb > 0 ? kb : 512) * 1024;
}

/** Extension and declared MIME type, checked before the file is read. */
export function isAllowedSubtitleFile(originalName: string, mimeType: string | undefined): boolean {
  return (
    path.extname(originalName).toLowerCase() === SUBTITLE_EXTENSION &&
    SUBTITLE_MIME_TYPES.has((mimeType ?? '').toLowerCase())
  );
}

/**
 * True when the content is a WebVTT file: optional UTF-8 BOM, then "WEBVTT"
 * followed by a space, tab, line break or the end of the file.
 */
export function looksLikeWebVtt(content: Buffer): boolean {
  let text = content.subarray(0, 64).toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return /^WEBVTT(?:[ \t\r\n]|$)/.test(text);
}
