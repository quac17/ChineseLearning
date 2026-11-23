import { ModuleSelection, ProgramModule } from './types';

export interface ModuleThemeConfig {
  id: ModuleSelection;
  name: string;
  han: string;
  card?: string;
  desc: string;
  c1: string;
  c2: string;
  grad: string;
}

export const SITE_INFO = {
  name: 'Chinese Learner',
  tagline: 'Con đường học tiếng Trung',
  contactText: 'Đăng ký học & mở khóa khóa học: Liên hệ Giáo viên phụ trách hoặc Admin hệ thống',
};

export const HOME_THEME: ModuleThemeConfig = {
  id: 'all',
  name: 'Tất cả',
  han: '学而时习之',
  desc: 'Học và thường xuyên ôn tập. Chọn một chương trình, màu giao diện sẽ đổi theo.',
  c1: '#1d4a8a',
  c2: '#b1342b',
  grad: 'linear-gradient(135deg,#102a52,#2d62ab)',
};

export const PROGRAM_MODULES: ModuleThemeConfig[] = [
  {
    id: 'easy',
    name: 'Easy Steps',
    han: '易',
    card: 'Cho bé và người mới bắt đầu',
    desc: 'Những bước đầu tiên, nhẹ nhàng như lá non đầu xuân.',
    c1: '#4e7d2f',
    c2: '#d99a2b',
    grad: 'linear-gradient(135deg,#2c4a17,#7a9b2e)',
  },
  {
    id: 'yct',
    name: 'YCT',
    han: '少',
    card: 'Chứng chỉ cho thiếu nhi',
    desc: 'Rực rỡ như tranh Đôn Hoàng, vui học cho thiếu nhi.',
    c1: '#c25a18',
    c2: '#1f7a7a',
    grad: 'linear-gradient(135deg,#6e260a,#d9701c)',
  },
  {
    id: 'hsk',
    name: 'HSK',
    han: '考',
    card: 'Lộ trình HSK 1–6',
    desc: 'Sóng ngọc lam và đường vàng, vững bước từng cấp.',
    c1: '#0f7c90',
    c2: '#b58a2e',
    grad: 'linear-gradient(135deg,#0a4655,#1a9fb4)',
  },
  {
    id: 'talk',
    name: 'Giao tiếp',
    han: '说',
    card: 'Hội thoại đời sống, thương mại',
    desc: 'Hội thoại đời sống, sắc tím lam của hoa sen đêm.',
    c1: '#4b4fa8',
    c2: '#c0508a',
    grad: 'linear-gradient(135deg,#1f2260,#6a3f9a)',
  },
];

export function getModuleTheme(mod: ModuleSelection): ModuleThemeConfig {
  if (mod === 'all') return HOME_THEME;
  return PROGRAM_MODULES.find((m) => m.id === mod) || HOME_THEME;
}

export function getModuleName(mod: ProgramModule): string {
  return PROGRAM_MODULES.find((m) => m.id === mod)?.name || mod.toUpperCase();
}
