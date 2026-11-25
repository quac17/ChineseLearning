'use client';

import { useEffect, useRef, useState } from 'react';
import { stopAudio } from '@/lib/speech';
import s from './teacher.module.css';

const MAX_RECORD_SECONDS = 30;

const PREFERRED_MIMES: Array<{ mime: string; ext: string }> = [
  { mime: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
];

function pickRecorderFormat(): { mimeType?: string; ext: string } {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return { ext: 'webm' };
  }
  for (const cand of PREFERRED_MIMES) {
    if (MediaRecorder.isTypeSupported(cand.mime)) {
      return { mimeType: cand.mime, ext: cand.ext };
    }
  }
  return { ext: 'webm' };
}

function extFromMime(mime: string | undefined, fallback: string): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp4' || base === 'audio/x-m4a' || base === 'audio/m4a') return 'm4a';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav';
  if (base === 'audio/mpeg' || base === 'audio/mp3') return 'mp3';
  if (base === 'audio/aac') return 'aac';
  if (base === 'audio/webm') return 'webm';
  return fallback;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export interface AudioRecorderProps {
  hasAudio: boolean;
  pendingLocal?: boolean;
  busy?: boolean;
  emptyHint?: string;
  onRecorded: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  onError?: (message: string) => void;
}

/**
 * Direct microphone recorder for vocabulary and listening-quiz audio overrides.
 * Records via MediaRecorder (max 30s), releases mic tracks immediately on stop/cancel,
 * and hands a File to the caller for immediate or deferred upload.
 */
export function AudioRecorder({
  hasAudio,
  pendingLocal = false,
  busy = false,
  emptyHint = 'Chưa ghi âm — tạm dùng thư viện có sẵn',
  onRecorded,
  onRemove,
  onError,
}: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const cleanup = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanup();
    };
  }, []);

  const stopRecording = (cancel: boolean) => {
    cancelledRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else {
      cleanup();
      setRecording(false);
      setSeconds(0);
    }
  };

  const startRecording = async () => {
    if (busy || recording) return;
    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      onError?.('Trình duyệt hoặc kết nối hiện tại không hỗ trợ ghi âm (cần HTTPS hoặc localhost).');
      return;
    }

    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mimeType, ext } = pickRecorderFormat();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const wasCancelled = cancelledRef.current;
        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const parts = [...chunksRef.current];
        cleanup();
        setRecording(false);
        setSeconds(0);

        if (wasCancelled) return;
        const blob = new Blob(parts, { type: actualMime });
        if (blob.size === 0) {
          onError?.('Không thu được âm thanh, vui lòng thử ghi âm lại.');
          return;
        }
        const finalExt = extFromMime(actualMime, ext);
        const file = new File([blob], `ghi-am-${Date.now()}.${finalExt}`, { type: actualMime });
        void onRecorded(file);
      };

      recorder.onerror = () => {
        cleanup();
        setRecording(false);
        setSeconds(0);
        onError?.('Có lỗi xảy ra trong quá trình ghi âm.');
      };

      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORD_SECONDS) {
            stopRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      cleanup();
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onError?.('Bạn chưa cấp quyền micro cho trình duyệt.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        onError?.('Không tìm thấy thiết bị micro trên máy.');
      } else {
        onError?.('Không thể khởi động micro để ghi âm.');
      }
    }
  };

  if (recording) {
    return (
      <div className={s.audioFileRow}>
        <span className={s.recStatus} role="status" aria-live="polite">
          <span className={s.recDot} aria-hidden="true" />
          Đang ghi {formatSeconds(seconds)}
        </span>
        <button
          type="button"
          className={s.recStopBtn}
          onClick={() => stopRecording(false)}
        >
          Dừng & lưu
        </button>
        <button
          type="button"
          className={s.audioRemoveBtn}
          onClick={() => stopRecording(true)}
        >
          Huỷ
        </button>
      </div>
    );
  }

  return (
    <div className={s.audioFileRow}>
      <button
        type="button"
        className={s.audioPickLabel}
        disabled={busy}
        onClick={() => void startRecording()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ marginRight: 5 }}>
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z" />
        </svg>
        <span>{busy ? 'Đang lưu...' : hasAudio ? 'Ghi âm lại' : 'Ghi âm'}</span>
      </button>
      {hasAudio && onRemove && (
        <button
          type="button"
          className={s.audioRemoveBtn}
          disabled={busy}
          onClick={() => void onRemove()}
        >
          Xoá
        </button>
      )}
      <span className={s.cellHint}>
        {hasAudio
          ? pendingLocal
            ? 'Đã ghi âm (bấm Lưu để tải lên)'
            : 'Đã ghi âm'
          : emptyHint}
      </span>
    </div>
  );
}
