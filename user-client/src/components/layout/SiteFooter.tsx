'use client';

import Link from 'next/link';
import { Logo } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { SUPPORT_CONTACT } from '@/lib/site';
import s from './layout.module.css';

/** Credit line for the stock photos in public/images/stock (see CREDITS.md there). */
export const STOCK_PHOTO_CREDITS =
  'Ảnh qua Wikimedia Commons: “20090529 Great Wall 8219”, Jakub Hałun, CC BY-SA 3.0 · “Chinese Brush for Writing Calligraphy”, epSos .de, CC BY 2.0 · “Reading book Ada Zangemann school France 2024 01”, FramaKa, CC BY-SA 4.0 · “Wikimedia Foundation Photography Collection 2023 006”, Wikimedia Foundation, CC BY-SA 4.0 · “Teochew Kanghu tea preparation”, James Creegan, CC BY 2.0 · “Beijing hutong 1”, lyng883, CC BY 2.0.';

export function SiteFooter({ showPhotoCredits = false }: { showPhotoCredits?: boolean }) {
  const { user } = useAuth();
  return (
    <footer className={s.footer}>
      <div className="container">
        <div className={s.footCols}>
          <nav aria-label="Chương trình">
            <ul>
              <li><Link href="/courses?program=easy">Easy Steps</Link></li>
              <li><Link href="/courses?program=yct">YCT</Link></li>
              <li><Link href="/courses?program=hsk">HSK</Link></li>
              <li><Link href="/courses?program=talk">Giao tiếp</Link></li>
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
              {user ? (
                <>
                  {user.role === 'STUDENT' && <li><Link href="/my-courses">Khoá học của tôi</Link></li>}
                  <li><Link href="/account">Tài khoản</Link></li>
                </>
              ) : (
                <>
                  <li><Link href="/login">Đăng nhập</Link></li>
                  <li><Link href="/register">Tạo tài khoản</Link></li>
                </>
              )}
            </ul>
          </nav>
          <div>
            <p style={{ lineHeight: 1.6 }}>
              Học thử miễn phí, mua từng khoá bằng mã QR ngân hàng qua PayOS.
              {SUPPORT_CONTACT ? ` Hỗ trợ: ${SUPPORT_CONTACT}.` : ''}
            </p>
          </div>
        </div>
        <div className={s.footBottom}>
          <Logo onDark height={32} />
          <nav aria-label="Pháp lý" className={s.footLegal}>
            <Link href="/dieu-khoan">Điều khoản sử dụng</Link>
            <Link href="/bao-mat">Chính sách bảo mật</Link>
          </nav>
          <span>© {new Date().getFullYear()} Chinese Learner</span>
        </div>
        {showPhotoCredits && <p className={s.credits}>{STOCK_PHOTO_CREDITS}</p>}
      </div>
    </footer>
  );
}
