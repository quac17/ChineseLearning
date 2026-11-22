'use client';

import { useEffect } from 'react';
import { Button, LinkButton } from '@/components/ui';
import { StatePage } from '@/components/layout/StatePage';

/** Error boundary for every route (docs/design/canvas/States.dc.html). */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Visible in the browser console only; never shown to the learner.
    console.error(error);
  }, [error]);

  return (
    <StatePage
      kicker="Lỗi máy chủ / mất kết nối"
      title="Không tải được nội dung"
      actions={
        <>
          <Button variant="ink" onClick={reset}>
            Thử lại
          </Button>
          <LinkButton href="/" variant="outline">
            Về trang chủ
          </LinkButton>
        </>
      }
    >
      Kết nối gặp trục trặc. Bài bạn đang học vẫn được lưu.
    </StatePage>
  );
}
