import {
  audioContentType,
  audioVersionParam,
  isAcceptableAudioMime,
  maxAudioBytes,
} from './audio-upload';

describe('audio-upload helpers', () => {
  it('maps allowed audio extensions to MIME types and rejects others', () => {
    expect(audioContentType('ni-hao.mp3')).toBe('audio/mpeg');
    expect(audioContentType('WORD.WAV')).toBe('audio/wav');
    expect(audioContentType('voice.m4a')).toBe('audio/mp4');
    expect(audioContentType('clip.ogg')).toBe('audio/ogg');
    expect(audioContentType('rec.webm')).toBe('audio/webm');
    expect(audioContentType('track.aac')).toBe('audio/aac');

    expect(audioContentType('video.mp4')).toBeNull();
    expect(audioContentType('script.sh')).toBeNull();
    expect(audioContentType('noext')).toBeNull();
  });

  it('accepts valid audio MIME types including codec parameters', () => {
    expect(isAcceptableAudioMime('audio/mpeg')).toBe(true);
    expect(isAcceptableAudioMime('audio/webm; codecs=opus')).toBe(true);
    expect(isAcceptableAudioMime('audio/mp4')).toBe(true);
    expect(isAcceptableAudioMime('application/octet-stream')).toBe(true);

    expect(isAcceptableAudioMime('video/mp4')).toBe(false);
    expect(isAcceptableAudioMime('text/plain')).toBe(false);
    expect(isAcceptableAudioMime(undefined)).toBe(false);
  });

  it('computes maxAudioBytes from env with 10 MB default', () => {
    expect(maxAudioBytes(undefined)).toBe(10 * 1024 * 1024);
    expect(maxAudioBytes('5')).toBe(5 * 1024 * 1024);
    expect(maxAudioBytes('0')).toBe(10 * 1024 * 1024);
    expect(maxAudioBytes('abc')).toBe(10 * 1024 * 1024);
  });

  it('extracts cache-busting version param from storageKey', () => {
    expect(audioVersionParam('audio/1730000000000-abcdef.mp3')).toBe('?v=1730000000000-abcdef');
    expect(audioVersionParam(null)).toBe('');
  });
});
