import Link from 'next/link';
import { Logo } from '@/components/ui';
import s from './layout.module.css';

/** Credit line for the stock photos in public/images/stock (see CREDITS.md there). */
export const STOCK_PHOTO_CREDITS =
  'Ảnh qua Wikimedia Commons: “20090529 Great Wall 8219”, Jakub Hałun, CC BY-SA 3.0 · “Chinese Brush for Writing Calligraphy”, epSos .de, CC BY 2.0 · “Reading book Ada Zangemann school France 2024 01”, FramaKa, CC BY-SA 4.0 · “Wikimedia Foundation Photography Collection 2023 006”, Wikimedia Foundation, CC BY-SA 4.0 · “Teochew Kanghu tea preparation”, James Creegan, CC BY 2.0 · “Beijing hutong 1”, lyng883, CC BY 2.0.';

export function SiteFooter({ showPhotoCredits = false }: { showPhotoCredits?: boolean }) {
  return (
    <footer className={s.footer}>
      <div className="container">
        <div className={s.footCols}>
          <nav aria-label="Chương trình">
            <ul>
              <li><Link href="/courses">Easy Steps</Link></li>
              <li><Link href="/courses">YCT</Link></li>
              <li><Link href="/courses">HSK</Link></li>
              <li><Link href="/courses">Giao tiếp</Link></li>
            </ul>
          </nav>
          <nav aria-label="Ôn tập">
            <ul>
              <li><Link href="/flashcards">Flashcard</Link></li>
              <li><Link href="/quiz">Quiz</Link></li>
              <li><Link href="/writing">Luyện viết chữ Hán</Link></li>
            </ul>
          </nav>
          <nav aria-label="Tài khoản">
            <ul>
              <li><Link href="/profile">Tài khoản</Link></li>
              <li><Link href="/login">Đăng nhập</Link></li>
              <li><Link href="/register">Tạo tài khoản</Link></li>
            </ul>
          </nav>
          <div>
            <p style={{ lineHeight: 1.6 }}>
              Đăng ký học và mở khoá khoá học: liên hệ giáo viên phụ trách hoặc quản trị viên.
            </p>
          </div>
        </div>
        <div className={s.footBottom}>
          <Logo onDark height={32} />
          <span>© {new Date().getFullYear()} Vân Kính</span>
        </div>
        {showPhotoCredits && <p className={s.credits}>{STOCK_PHOTO_CREDITS}</p>}
      </div>
    </footer>
  );
}
