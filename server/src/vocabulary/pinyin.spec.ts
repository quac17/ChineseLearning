import { normalizePinyin } from './pinyin';

describe('normalizePinyin', () => {
  it.each([
    ['jiao4', 'jiào'],
    ['ni3 hao3', 'nǐ hǎo'],
    ['ni3hao3', 'nǐhǎo'],
    ['xie4xie5', 'xièxie'],
    ['zhong1 guo2', 'zhōng guó'],
    ['dou1', 'dōu'],
    ['gui4', 'guì'],
    ['liu2', 'liú'],
    ['lv4', 'lǜ'],
    ['nu:3', 'nǚ'],
    ['lüe4', 'lüè'],
    ['Bei3jing1', 'Běijīng'],
    ['  wo3   shi4  ', 'wǒ shì'],
    ['ma0', 'ma'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePinyin(input)).toBe(expected);
  });

  it('leaves pinyin that already has tone marks unchanged', () => {
    expect(normalizePinyin('nǐ hǎo')).toBe('nǐ hǎo');
    expect(normalizePinyin('Yuènán rén')).toBe('Yuènán rén');
  });
});
