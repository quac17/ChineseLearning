import { isAllowedSubtitleFile, looksLikeWebVtt, subtitleMaxBytes } from './subtitle';

describe('isAllowedSubtitleFile', () => {
  it('accepts .vtt with the types browsers send', () => {
    expect(isAllowedSubtitleFile('bai-1.vtt', 'text/vtt')).toBe(true);
    expect(isAllowedSubtitleFile('BAI-1.VTT', 'application/octet-stream')).toBe(true);
    expect(isAllowedSubtitleFile('bai-1.vtt', undefined)).toBe(true);
  });

  it('rejects other extensions and odd types', () => {
    expect(isAllowedSubtitleFile('bai-1.srt', 'text/plain')).toBe(false);
    expect(isAllowedSubtitleFile('bai-1.vtt.exe', 'text/vtt')).toBe(false);
    expect(isAllowedSubtitleFile('bai-1.vtt', 'video/mp4')).toBe(false);
    expect(isAllowedSubtitleFile('bai-1.vtt', 'text/html')).toBe(false);
  });
});

describe('looksLikeWebVtt', () => {
  const vtt = (s: string) => Buffer.from(s, 'utf8');

  it('accepts the WEBVTT header, with or without BOM or a title', () => {
    expect(looksLikeWebVtt(vtt('WEBVTT\n\n00:00.000 --> 00:02.000\nnǐ hǎo'))).toBe(true);
    expect(looksLikeWebVtt(vtt('﻿WEBVTT\r\n'))).toBe(true);
    expect(looksLikeWebVtt(vtt('WEBVTT - Bài 1 pinyin\n'))).toBe(true);
    expect(looksLikeWebVtt(vtt('WEBVTT'))).toBe(true);
  });

  it('rejects SRT, HTML and look-alikes', () => {
    expect(looksLikeWebVtt(vtt('1\n00:00:00,000 --> 00:00:02,000\nnǐ hǎo'))).toBe(false);
    expect(looksLikeWebVtt(vtt('<html>WEBVTT</html>'))).toBe(false);
    expect(looksLikeWebVtt(vtt('WEBVTTX\n'))).toBe(false);
    expect(looksLikeWebVtt(Buffer.alloc(0))).toBe(false);
  });
});

describe('subtitleMaxBytes', () => {
  it('defaults to 512 KB and reads MAX_SUBTITLE_SIZE_KB', () => {
    expect(subtitleMaxBytes({})).toBe(512 * 1024);
    expect(subtitleMaxBytes({ MAX_SUBTITLE_SIZE_KB: '100' })).toBe(100 * 1024);
    expect(subtitleMaxBytes({ MAX_SUBTITLE_SIZE_KB: 'abc' })).toBe(512 * 1024);
  });
});
