'use client';

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
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh-cn')) ??
    synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'));
  if (voice) u.voice = voice;
  synth.speak(u);
  return true;
}
