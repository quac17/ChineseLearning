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

export interface FlashcardDeck {
  id: string;
  module: ProgramModule;
  title: string;
  cards: Array<{ han: string; pinyin: string; vi: string }>;
}

export const DEMO_FLASHCARDS: FlashcardDeck[] = [
  {
    id: 'hsk1-b1',
    module: 'hsk',
    title: 'HSK 1 – Bài 1',
    cards: [
      { han: '你好', pinyin: 'nǐ hǎo', vi: 'Xin chào' },
      { han: '谢谢', pinyin: 'xièxie', vi: 'Cảm ơn' },
      { han: '再见', pinyin: 'zàijiàn', vi: 'Tạm biệt' },
      { han: '老师', pinyin: 'lǎoshī', vi: 'Giáo viên' },
      { han: '学生', pinyin: 'xuésheng', vi: 'Học sinh' },
      { han: '水', pinyin: 'shuǐ', vi: 'Nước' },
      { han: '茶', pinyin: 'chá', vi: 'Trà' },
      { han: '朋友', pinyin: 'péngyou', vi: 'Bạn bè' },
      { han: '中国', pinyin: 'Zhōngguó', vi: 'Trung Quốc' },
      { han: '越南', pinyin: 'Yuènán', vi: 'Việt Nam' },
      { han: '喜欢', pinyin: 'xǐhuan', vi: 'Thích' },
      { han: '学习', pinyin: 'xuéxí', vi: 'Học tập' },
    ],
  },
  {
    id: 'easy-b1',
    module: 'easy',
    title: 'Easy Steps – Bài 1',
    cards: [
      { han: '妈妈', pinyin: 'māma', vi: 'Mẹ' },
      { han: '爸爸', pinyin: 'bàba', vi: 'Bố' },
      { han: '猫', pinyin: 'māo', vi: 'Con mèo' },
      { han: '狗', pinyin: 'gǒu', vi: 'Con chó' },
    ],
  },
  {
    id: 'talk-b1',
    module: 'talk',
    title: 'Giao tiếp – Quán trà',
    cards: [
      { han: '咖啡', pinyin: 'kāfēi', vi: 'Cà phê' },
      { han: '奶茶', pinyin: 'nǎichá', vi: 'Trà sữa' },
      { han: '多少钱', pinyin: 'duōshao qián', vi: 'Bao nhiêu tiền' },
      { han: '不客气', pinyin: 'bú kèqi', vi: 'Đừng khách sáo' },
    ],
  },
];

export type QuizQuestion =
  | {
      type: 'choice';
      q: string;
      hint?: string;
      options: string[];
      answer: number[];
    }
  | {
      type: 'order';
      q: string;
      hint?: string;
      answer: string[];
    }
  | {
      type: 'fill';
      q: string;
      hint?: string;
      text: string;
      answers: string[];
    }
  | {
      type: 'match';
      q: string;
      hint?: string;
      left: string[];
      right: string[];
      pairs: number[];
    };

export interface QuizDeck {
  id: string;
  module: ProgramModule;
  title: string;
  questions: QuizQuestion[];
}

export const DEMO_QUIZZES: QuizDeck[] = [
  {
    id: 'hsk1-b1',
    module: 'hsk',
    title: 'HSK 1 – Bài 1: Ôn tập',
    questions: [
      {
        type: 'choice',
        q: 'Chọn tất cả đồ uống',
        hint: 'Có thể có nhiều đáp án đúng',
        options: ['茶', '水', '书', '咖啡'],
        answer: [0, 1, 3],
      },
      {
        type: 'order',
        q: 'Sắp xếp thành câu đúng',
        answer: ['我', '喜欢', '喝', '茶'],
      },
      {
        type: 'fill',
        q: 'Điền từ còn thiếu (chữ Hán hoặc pinyin)',
        text: '我___中国人。',
        answers: ['是', 'shi', 'shì'],
      },
      {
        type: 'match',
        q: 'Nối cột A với cột B',
        hint: 'Cột B có một ô gây nhiễu',
        left: ['你好', '谢谢', '再见'],
        right: ['Xin chào', 'Cảm ơn', 'Tạm biệt', 'Xin lỗi'],
        pairs: [0, 1, 2],
      },
    ],
  },
  {
    id: 'easy-b1',
    module: 'easy',
    title: 'Easy Steps – Bài 1: Gia đình',
    questions: [
      {
        type: 'choice',
        q: '“妈妈” nghĩa là gì?',
        options: ['Bố', 'Mẹ', 'Anh trai'],
        answer: [1],
      },
      {
        type: 'fill',
        q: 'Viết pinyin của 猫',
        text: '___',
        answers: ['māo', 'mao'],
      },
    ],
  },
];

export const WRITING_CHARS = ['永', '人', '学', '你', '好', '中', '国', '茶', '水'];
