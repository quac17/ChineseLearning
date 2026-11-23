import type { ProgramItem, ProgramModule } from './types';

export interface ProgramDisplayMeta {
  name: string;
  han: string;
  color: string;
}

/** Fallback colours and labels for initial render before /api/programs loads. */
export const PROGRAMS: Record<string, ProgramDisplayMeta> = {
  easy: { name: 'Easy Steps', han: '易', color: 'var(--prog-easy)' },
  yct: { name: 'YCT', han: '少', color: 'var(--prog-yct)' },
  hsk: { name: 'HSK', han: '考', color: 'var(--prog-hsk)' },
  talk: { name: 'Giao tiếp', han: '说', color: 'var(--prog-talk)' },
};

export const PROGRAM_ORDER: ProgramModule[] = ['easy', 'yct', 'hsk', 'talk'];

export const DEFAULT_PROGRAM_ITEMS: ProgramItem[] = [
  {
    code: 'easy',
    name: 'Easy Steps',
    han: '易',
    cardDesc: 'Cho bé và người mới bắt đầu',
    description: 'Những bước đầu tiên, nhẹ nhàng như lá non đầu xuân.',
    color1: '#4e7d2f',
    color2: '#d99a2b',
    sortOrder: 1,
  },
  {
    code: 'yct',
    name: 'YCT',
    han: '少',
    cardDesc: 'Chứng chỉ cho thiếu nhi',
    description: 'Rực rỡ như tranh Đôn Hoàng, vui học cho thiếu nhi.',
    color1: '#c25a18',
    color2: '#1f7a7a',
    sortOrder: 2,
  },
  {
    code: 'hsk',
    name: 'HSK',
    han: '考',
    cardDesc: 'Lộ trình HSK 1–6',
    description: 'Sóng ngọc lam và đường vàng, vững bước từng cấp.',
    color1: '#0f7c90',
    color2: '#b58a2e',
    sortOrder: 3,
  },
  {
    code: 'talk',
    name: 'Giao tiếp',
    han: '说',
    cardDesc: 'Hội thoại đời sống, thương mại',
    description: 'Hội thoại đời sống, sắc tím lam của hoa sen đêm.',
    color1: '#4b4fa8',
    color2: '#c0508a',
    sortOrder: 4,
  },
];

export function getProgramMeta(
  code: string,
  programMap?: Record<string, ProgramDisplayMeta>,
): ProgramDisplayMeta {
  const fromMap = programMap?.[code];
  if (fromMap) return fromMap;
  const fromStatic = PROGRAMS[code];
  if (fromStatic) return fromStatic;
  return { name: code.toUpperCase(), han: code.slice(0, 1).toUpperCase() || '文', color: 'var(--prog-hsk)' };
}

/** "499.000 ₫" */
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}
