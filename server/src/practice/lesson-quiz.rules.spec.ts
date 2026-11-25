import { BadRequestException } from '@nestjs/common';
import { normalizeQuizQuestion } from './lesson-quiz.rules';

describe('normalizeQuizQuestion', () => {
  it('normalizes a valid choice question', () => {
    const out = normalizeQuizQuestion(
      {
        kind: 'choice',
        prompt: '  “你好” nghĩa là gì?  ',
        payload: {
          options: [' xin chào ', 'cảm ơn', 'tạm biệt', 'giáo viên'],
          correctIndex: 0,
          explanation: '  你好 nǐ hǎo  ',
        },
      },
      0,
    );
    expect(out.kind).toBe('choice');
    expect(out.prompt).toBe('“你好” nghĩa là gì?');
    expect(out.payload).toEqual({
      options: ['xin chào', 'cảm ơn', 'tạm biệt', 'giáo viên'],
      correctIndex: 0,
      explanation: '你好 nǐ hǎo',
    });
  });

  it('rejects choice without prompt or with out-of-range correctIndex', () => {
    expect(() =>
      normalizeQuizQuestion(
        { kind: 'choice', prompt: '   ', payload: { options: ['a', 'b'], correctIndex: 0 } },
        0,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      normalizeQuizQuestion(
        { kind: 'choice', prompt: 'Q?', payload: { options: ['a', 'b'], correctIndex: 3 } },
        1,
      ),
    ).toThrow(BadRequestException);
  });

  it('validates listen questions with ttsText, vocabularyId, or audioOverride', () => {
    const withTts = normalizeQuizQuestion(
      {
        kind: 'listen',
        prompt: 'Nghe chọn đáp án',
        payload: { ttsText: '谢谢', options: ['cảm ơn', 'xin chào'], correctIndex: 0 },
      },
      0,
    );
    expect(withTts.payload).toEqual({
      ttsText: '谢谢',
      options: ['cảm ơn', 'xin chào'],
      correctIndex: 0,
    });

    const withOverride = normalizeQuizQuestion(
      {
        kind: 'listen',
        audioOverride: true,
        payload: { ttsText: '', options: ['A', 'B'], correctIndex: 1 },
      },
      0,
    );
    expect(withOverride.audioOverride).toBe(true);

    expect(() =>
      normalizeQuizQuestion(
        {
          kind: 'listen',
          payload: { ttsText: '', options: ['A', 'B'], correctIndex: 0 },
        },
        0,
      ),
    ).toThrow(BadRequestException);
  });

  it('normalizes order, fill (including pinyin tones), and match questions', () => {
    const order = normalizeQuizQuestion(
      { kind: 'order', payload: { pieces: ['我', '是', '学生'], meaningVi: 'Tôi là học sinh' } },
      0,
    );
    expect(order.payload).toEqual({ pieces: ['我', '是', '学生'], meaningVi: 'Tôi là học sinh' });

    const fill = normalizeQuizQuestion(
      {
        kind: 'fill',
        payload: { before: '我', after: '老师。', answerHanzi: '是', answerPinyin: 'shi4' },
      },
      1,
    );
    expect(fill.payload).toEqual({
      before: '我',
      after: '老师。',
      answerHanzi: '是',
      answerPinyin: 'shì',
    });

    const match = normalizeQuizQuestion(
      {
        kind: 'match',
        payload: {
          pairs: [
            { left: '你好', right: 'xin chào' },
            { left: '谢谢', right: 'cảm ơn' },
          ],
        },
      },
      2,
    );
    expect(match.payload).toEqual({
      pairs: [
        { left: '你好', right: 'xin chào' },
        { left: '谢谢', right: 'cảm ơn' },
      ],
    });
  });

  it('rejects incomplete match pairs and fill without answerHanzi', () => {
    expect(() =>
      normalizeQuizQuestion(
        { kind: 'match', payload: { pairs: [{ left: '你好', right: '' }, { left: '谢谢', right: 'cảm ơn' }] } },
        0,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      normalizeQuizQuestion({ kind: 'fill', payload: { before: '我', after: '人', answerHanzi: '  ' } }, 0),
    ).toThrow(BadRequestException);
  });
});
