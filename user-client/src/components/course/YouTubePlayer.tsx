'use client';

import { useEffect, useRef, useState } from 'react';
import s from './YouTubePlayer.module.css';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __ytApiLoadingCallbacks?: Array<() => void>;
  }
}

function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }

  return new Promise((resolve) => {
    if (!window.__ytApiLoadingCallbacks) {
      window.__ytApiLoadingCallbacks = [];
    }
    window.__ytApiLoadingCallbacks.push(() => resolve(window.YT));

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        const cbs = window.__ytApiLoadingCallbacks || [];
        window.__ytApiLoadingCallbacks = [];
        cbs.forEach((cb) => cb());
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sm = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
  }
  return `${m}:${String(sm).padStart(2, '0')}`;
}

export function YouTubePlayer({
  youtubeId,
  title,
}: {
  youtubeId: string;
  title: string;
}) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    let mounted = true;
    let pollId: ReturnType<typeof setInterval> | null = null;

    setReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    loadYouTubeIframeApi().then((YT) => {
      if (!mounted || !YT || !slotRef.current) return;

      const applyIframeAttrs = (p: any) => {
        const iframe = p?.getIframe?.();
        if (iframe) {
          iframe.setAttribute('title', title);
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = '0';
          iframe.style.pointerEvents = 'none';
        }
      };

      playerRef.current = new YT.Player(slotRef.current, {
        videoId: youtubeId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          fs: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: (e: any) => {
            if (!mounted) return;
            setReady(true);
            setDuration(e.target.getDuration() || 0);
            applyIframeAttrs(e.target);
          },
          onStateChange: (e: any) => {
            if (!mounted) return;
            setPlaying(e.data === 1);
            const dur = e.target.getDuration?.() || 0;
            if (dur > 0) setDuration(dur);
          },
        },
      });
      applyIframeAttrs(playerRef.current);

      pollId = setInterval(() => {
        const p = playerRef.current;
        if (p && typeof p.getCurrentTime === 'function') {
          setCurrentTime(p.getCurrentTime() || 0);
          const dur = p.getDuration?.() || 0;
          if (dur > 0) setDuration(dur);
        }
      }, 300);
    });

    return () => {
      mounted = false;
      if (pollId) clearInterval(pollId);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore destroy errors
        }
      }
      playerRef.current = null;
    };
  }, [youtubeId, title]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };

  const handleSeek = (nextSec: number) => {
    const p = playerRef.current;
    if (!p || !ready) return;
    setCurrentTime(nextSec);
    p.seekTo(nextSec, true);
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (muted) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  };

  const handleVolume = (val: number) => {
    const p = playerRef.current;
    setVolume(val);
    if (!p || !ready) return;
    p.setVolume(val);
    if (val === 0) {
      p.mute();
      setMuted(true);
    } else if (muted) {
      p.unMute();
      setMuted(false);
    }
  };

  const handleRate = (nextRate: number) => {
    setRate(nextRate);
    const p = playerRef.current;
    if (p && ready && typeof p.setPlaybackRate === 'function') {
      p.setPlaybackRate(nextRate);
    }
  };

  const toggleFullscreen = () => {
    const stageEl = overlayRef.current?.parentElement;
    if (!stageEl) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stageEl.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <>
      <div className={s.iframeHost} ref={slotRef} />

      {/* Lớp overlay trong suốt chặn click vào tiêu đề, logo và nút Share của YouTube */}
      <div
        ref={overlayRef}
        className={s.overlay}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={playing ? 'Tạm dừng video' : 'Phát video'}
      >
        {!playing && (
          <button
            type="button"
            className={s.centerBtn}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label="Phát video"
          >
            ▶
          </button>
        )}
      </div>

      {/* Thanh điều khiển riêng */}
      <div
        className={s.controls}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className={s.ctrlBtn}
          onClick={togglePlay}
          title={playing ? 'Tạm dừng' : 'Phát'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <span className={s.time}>
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </span>

        <input
          type="range"
          className={s.seek}
          min={0}
          max={duration || 100}
          step={0.5}
          value={Math.min(currentTime, duration || 100)}
          onChange={(e) => handleSeek(Number(e.target.value))}
          aria-label="Tua video"
        />

        <button
          type="button"
          className={s.ctrlBtn}
          onClick={toggleMute}
          title={muted ? 'Bật tiếng' : 'Tắt tiếng'}
        >
          {muted || volume === 0 ? '🔇' : '🔊'}
        </button>

        <input
          type="range"
          className={s.vol}
          min={0}
          max={100}
          value={muted ? 0 : volume}
          onChange={(e) => handleVolume(Number(e.target.value))}
          aria-label="Âm lượng"
        />

        <select
          className={s.speed}
          value={rate}
          onChange={(e) => handleRate(Number(e.target.value))}
          aria-label="Tốc độ phát"
        >
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>

        <button
          type="button"
          className={s.ctrlBtn}
          onClick={toggleFullscreen}
          title="Toàn màn hình"
        >
          ⛶
        </button>
      </div>
    </>
  );
}
