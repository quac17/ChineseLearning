import { BadRequestException } from '@nestjs/common';
import { QuizQuestionKind } from '../common/types/domain.types';
import { normalizePinyin } from '../vocabulary/pinyin';

export interface ChoiceQuizPayload {
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface ListenQuizPayload {
  ttsText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface OrderQuizPayload {
  pieces: string[];
  meaningVi?: string;
}

export interface FillQuizPayload {
  before: string;
  after: string;
  answerHanzi: string;
  answerPinyin?: string;
  meaningVi?: string;
}

export interface MatchQuizPayload {
  pairs: Array<{ left: string; right: string }>;
}

export type QuizQuestionPayload =
  | ChoiceQuizPayload
  | ListenQuizPayload
  | OrderQuizPayload
  | FillQuizPayload
  | MatchQuizPayload;

export interface RawQuizQuestionInput {
  id?: string;
  kind: QuizQuestionKind;
  vocabularyId?: string | null;
  prompt?: string | null;
  audioOverride?: boolean;
  payload: Record<string, any>;
}

export interface NormalizedQuizQuestion {
  id: string | null;
  kind: QuizQuestionKind;
  vocabularyId: string | null;
  prompt: string | null;
  audioOverride?: boolean;
  payload: QuizQuestionPayload;
}

const VALID_KINDS: ReadonlySet<string> = new Set(['choice', 'listen', 'order', 'fill', 'match']);

function trimStr(v: unknown, maxLen: number): string {
  return typeof v === 'string' ? v.trim().slice(0, maxLen) : '';
}

function normalizeOptions(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException(`${label}: cần danh sách đáp án (2 đến 6 lựa chọn).`);
  }
  const options = raw.map((x) => trimStr(x, 255)).filter((x) => x.length > 0);
  if (options.length < 2 || options.length > 6) {
    throw new BadRequestException(`${label}: cần từ 2 đến 6 đáp án không rỗng.`);
  }
  return options;
}

function normalizeCorrectIndex(raw: unknown, length: number, label: string): number {
  const idx = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(idx) || idx < 0 || idx >= length) {
    throw new BadRequestException(`${label}: đáp án đúng không hợp lệ.`);
  }
  return idx;
}

/**
 * Validates and cleans a single manual quiz question before saving to DB.
 * Throws BadRequestException with a clear Vietnamese message referencing the 1-based row number.
 */
export function normalizeQuizQuestion(input: RawQuizQuestionInput, index: number): NormalizedQuizQuestion {
  const label = `Câu ${index + 1}`;
  if (!VALID_KINDS.has(input.kind)) {
    throw new BadRequestException(`${label}: loại câu hỏi không hợp lệ.`);
  }
  const rawPayload = input.payload && typeof input.payload === 'object' ? input.payload : {};
  const prompt = trimStr(input.prompt, 500) || null;
  const vocabularyId = trimStr(input.vocabularyId, 64) || null;
  const id = trimStr(input.id, 64) || null;

  let payload: QuizQuestionPayload;
  switch (input.kind) {
    case 'choice': {
      if (!prompt) {
        throw new BadRequestException(`${label} (Chọn đáp án): cần nhập nội dung câu hỏi.`);
      }
      const options = normalizeOptions(rawPayload.options, `${label} (Chọn đáp án)`);
      const correctIndex = normalizeCorrectIndex(rawPayload.correctIndex, options.length, `${label} (Chọn đáp án)`);
      const explanation = trimStr(rawPayload.explanation, 500) || undefined;
      payload = { options, correctIndex, ...(explanation ? { explanation } : {}) };
      break;
    }
    case 'listen': {
      const ttsText = trimStr(rawPayload.ttsText, 200);
      const options = normalizeOptions(rawPayload.options, `${label} (Nghe chọn đáp án)`);
      const correctIndex = normalizeCorrectIndex(
        rawPayload.correctIndex,
        options.length,
        `${label} (Nghe chọn đáp án)`,
      );
      const explanation = trimStr(rawPayload.explanation, 500) || undefined;
      if (!ttsText && !vocabularyId && !input.audioOverride) {
        throw new BadRequestException(
          `${label} (Nghe chọn đáp án): cần nhập chữ Hán để phát âm, chọn từ vựng liên kết hoặc bật ghi đè âm thanh.`,
        );
      }
      payload = { ttsText, options, correctIndex, ...(explanation ? { explanation } : {}) };
      break;
    }
    case 'order': {
      if (!Array.isArray(rawPayload.pieces)) {
        throw new BadRequestException(`${label} (Sắp xếp câu): cần danh sách các từ/mảnh câu.`);
      }
      const pieces = rawPayload.pieces.map((x: unknown) => trimStr(x, 100)).filter((x: string) => x.length > 0);
      if (pieces.length < 2 || pieces.length > 12) {
        throw new BadRequestException(`${label} (Sắp xếp câu): cần từ 2 đến 12 mảnh câu.`);
      }
      const meaningVi = trimStr(rawPayload.meaningVi, 500) || undefined;
      payload = { pieces, ...(meaningVi ? { meaningVi } : {}) };
      break;
    }
    case 'fill': {
      const before = typeof rawPayload.before === 'string' ? rawPayload.before.slice(0, 500) : '';
      const after = typeof rawPayload.after === 'string' ? rawPayload.after.slice(0, 500) : '';
      const answerHanzi = trimStr(rawPayload.answerHanzi, 100);
      if (!answerHanzi) {
        throw new BadRequestException(`${label} (Điền từ): cần nhập đáp án chữ Hán.`);
      }
      const rawPinyin = trimStr(rawPayload.answerPinyin, 120);
      const answerPinyin = rawPinyin ? normalizePinyin(rawPinyin) : undefined;
      const meaningVi = trimStr(rawPayload.meaningVi, 500) || undefined;
      payload = {
        before,
        after,
        answerHanzi,
        ...(answerPinyin ? { answerPinyin } : {}),
        ...(meaningVi ? { meaningVi } : {}),
      };
      break;
    }
    case 'match': {
      if (!Array.isArray(rawPayload.pairs)) {
        throw new BadRequestException(`${label} (Nối cặp): cần danh sách các cặp ghép.`);
      }
      const pairs = rawPayload.pairs
        .map((p: any) => ({
          left: trimStr(p?.left, 100),
          right: trimStr(p?.right, 255),
        }))
        .filter((p) => p.left.length > 0 || p.right.length > 0);
      if (pairs.length < 2 || pairs.length > 6) {
        throw new BadRequestException(`${label} (Nối cặp): cần từ 2 đến 6 cặp ghép.`);
      }
      if (pairs.some((p) => !p.left || !p.right)) {
        throw new BadRequestException(`${label} (Nối cặp): mỗi cặp cần đủ vế trái và vế phải.`);
      }
      payload = { pairs };
      break;
    }
  }

  return {
    id,
    kind: input.kind,
    vocabularyId,
    prompt,
    audioOverride: input.audioOverride,
    payload,
  };
}
