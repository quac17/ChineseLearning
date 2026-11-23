'use client';

import type { CSSProperties, ReactNode } from 'react';
import { usePrograms } from '@/context/ModuleContext';
import type { ProgramModule } from '@/lib/types';
import s from './ui.module.css';

export type BadgeTone =
  | 'featured'
  | 'new'
  | 'preview'
  | 'owned'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'backend';

const TONE_CLASS: Record<BadgeTone, string> = {
  featured: s.featured,
  new: s.new,
  preview: s.preview,
  owned: s.owned,
  neutral: s.neutral,
  success: s.successTone,
  warning: s.warningTone,
  error: s.errorTone,
  info: s.infoTone,
  backend: s.backend,
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`${s.badge} ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function ProgramBadge({ program }: { program: ProgramModule }) {
  const { getProgram } = usePrograms();
  const p = getProgram(program);
  return (
    <span className={`${s.badge} ${s.program}`} style={{ background: p.color }}>
      {p.name}
    </span>
  );
}

interface RatingProps {
  /** 1–5. */
  value?: number | null;
  /** Where the number comes from, e.g. "khảo sát 120 học viên lớp offline 2025". */
  source?: string | null;
}

/**
 * Renders "4,5 ★ · <source>". Renders nothing unless both value and source
 * exist: never show an unsourced rating (docs/design/DECISIONS.md).
 */
export function Rating({ value, source }: RatingProps) {
  if (value == null || !source?.trim()) return null;
  const text = value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span className={s.rating}>
      <span className={s.ratingValue}>
        {text} <span aria-hidden="true">★</span>
        <span className="sr-only">trên 5 sao</span>
      </span>
      <span className={s.ratingSource}>· {source}</span>
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={s.progress}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={s.progressFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

const ALERT_TONE = { success: s.successTone, error: s.errorTone, warning: s.warningTone, info: s.infoTone };

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof ALERT_TONE;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`${s.alert} ${ALERT_TONE[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>
        {title && <b>{title} </b>}
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, style }: { width?: number | string; height?: number | string; style?: CSSProperties }) {
  return <span className={s.skeleton} style={{ width, height, ...style }} aria-hidden="true" />;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={s.empty}>
      <h2 className={s.emptyTitle}>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </section>
  );
}
