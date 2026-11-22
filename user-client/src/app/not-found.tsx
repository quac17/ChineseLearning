import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui';
import { StatePage } from '@/components/layout/StatePage';

export const metadata: Metadata = { title: 'Không tìm thấy trang' };

/** 404 (docs/design/canvas/States.dc.html). */
export default function NotFound() {
  return (
    <StatePage
      kicker="404 · Không tìm thấy"
      han="迷路"
      title="Lạc đường rồi"
      actions={
        <>
          <LinkButton href="/" variant="ink">
            Về trang chủ
          </LinkButton>
          <LinkButton href="/courses" variant="outline">
            Xem khoá học
          </LinkButton>
        </>
      }
    >
      Trang này không tồn tại hoặc đã được chuyển đi.
    </StatePage>
  );
}
