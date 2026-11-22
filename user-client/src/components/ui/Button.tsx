import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import s from './ui.module.css';

export type ButtonVariant = 'accent' | 'ink' | 'outline' | 'subtle' | 'danger' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconOnly?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function buttonClass({
  variant = 'ink',
  size = 'md',
  block,
  iconOnly,
  className,
}: Pick<CommonProps, 'variant' | 'size' | 'block' | 'iconOnly'> & { className?: string }) {
  return [
    s.btn,
    s[variant],
    size !== 'md' ? s[size] : '',
    block ? s.block : '',
    iconOnly ? s.iconOnly : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Accent = buy only (one per view). Ink = sign up / log in / primary action.
 * Outline = secondary. Icon-only buttons need an aria-label.
 */
export function Button({
  variant,
  size,
  block,
  iconOnly,
  loading,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, iconOnly, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={s.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

export function LinkButton({
  variant,
  size,
  block,
  iconOnly,
  children,
  className,
  href,
  ...rest
}: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block, iconOnly, className })} {...rest}>
      {children}
    </Link>
  );
}
