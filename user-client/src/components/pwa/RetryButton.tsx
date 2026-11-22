'use client';

import { Button } from '@/components/ui';

/** Reloads the page the learner was trying to open (the URL is unchanged). */
export function RetryButton() {
  return (
    <Button variant="ink" onClick={() => window.location.reload()}>
      Thử lại
    </Button>
  );
}
