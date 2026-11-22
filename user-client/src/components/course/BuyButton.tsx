'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, LinkButton, useToast } from '@/components/ui';
import type { ButtonSize } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { routes } from '@/lib/courses';
import type { OrderItem } from '@/lib/types';
import { useOnline } from '@/lib/useOnline';

/**
 * "Mua ngay bằng QR": creates (or reuses) an order and opens the checkout
 * page. Logged-out learners go to login first and come back here.
 */
export function BuyButton({
  courseId,
  size,
  block,
  label = 'Mua ngay bằng QR',
  className,
}: {
  courseId: string;
  size?: ButtonSize;
  block?: boolean;
  label?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const online = useOnline();

  if (!user) {
    return (
      <LinkButton href={routes.login(pathname)} variant="accent" size={size} block={block} className={className}>
        {label}
      </LinkButton>
    );
  }

  const buy = async () => {
    setBusy(true);
    try {
      const order = await apiRequest<OrderItem>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      });
      router.push(routes.checkout(order.id));
    } catch (err) {
      toast.show((err as Error).message || 'Không tạo được đơn thanh toán.');
      setBusy(false);
    }
  };

  return (
    <Button variant="accent" size={size} block={block} loading={busy} disabled={!online} onClick={buy} className={className}>
      {label}
    </Button>
  );
}
