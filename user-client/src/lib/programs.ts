import type { ProgramModule } from './types';

/** Program colours and labels for covers, tiles and tags (approved design). */
export const PROGRAMS: Record<ProgramModule, { name: string; han: string; color: string }> = {
  easy: { name: 'Easy Steps', han: '易', color: 'var(--prog-easy)' },
  yct: { name: 'YCT', han: '少', color: 'var(--prog-yct)' },
  hsk: { name: 'HSK', han: '考', color: 'var(--prog-hsk)' },
  talk: { name: 'Giao tiếp', han: '说', color: 'var(--prog-talk)' },
};

export const PROGRAM_ORDER: ProgramModule[] = ['easy', 'yct', 'hsk', 'talk'];

/** "499.000 ₫" */
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}
