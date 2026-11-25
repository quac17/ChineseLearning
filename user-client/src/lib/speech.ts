'use client';

import { buildMediaUrl } from './api';

let activeAudio: HTMLAudioElement | null = null;

/** Stops any currently playing uploaded audio or browser speech synthesis. */
export function stopAudio(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Chinese pronunciation with the browser's own text-to-speech (no audio files,
 * no third-party service). Returns false when the device has no Chinese voice.
 */
export function canSpeakChinese(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  // Some browsers load voices lazily: an empty list does not mean "no voice".
  return voices.length === 0 || voices.some((v) => v.lang.toLowerCase().startsWith('zh'));
}

export function speakChinese(text: string, rate = 0.85): boolean {
  if (!canSpeakChinese()) return false;
  stopAudio();
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate;
  const voice =
    synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh-cn')) ??
    synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'));
  if (voice) u.voice = voice;
  synth.speak(u);
  return true;
}

/** Plays an audio URL (no crossOrigin so cookies travel same-site and GCS 302 needs no CORS). */
export async function playAudioUrl(url: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
  stopAudio();
  const audio = new Audio(url);
  activeAudio = audio;
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) activeAudio = null;
  });
  try {
    await audio.play();
    return true;
  } catch {
    if (activeAudio === audio) activeAudio = null;
    return false;
  }
}

/**
 * Plays a word's custom overridden audio when present, otherwise uses the
 * browser's built-in Chinese speech library.
 *
 * Never falls back to TTS when an overridden audio URL/path is configured:
 * browser autoplay blocks (NotAllowedError) or effect cleanups (AbortError)
 * would otherwise accidentally play the default TTS voice instead of the recording.
 */
export async function playWordAudio(opts: {
  audioPath?: string | null;
  localUrl?: string | null;
  text?: string | null;
  rate?: number;
}): Promise<boolean> {
  if (opts.localUrl) {
    return playAudioUrl(opts.localUrl);
  }
  if (opts.audioPath) {
    return playAudioUrl(buildMediaUrl(opts.audioPath));
  }
  if (opts.text?.trim()) {
    return speakChinese(opts.text.trim(), opts.rate);
  }
  return false;
}
