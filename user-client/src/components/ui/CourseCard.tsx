'use client';

import Link from 'next/link';
import { usePrograms } from '@/context/ModuleContext';
import { formatVnd } from '@/lib/programs';
import type { ProgramModule } from '@/lib/types';
import { Badge, ProgressBar, Rating } from './Display';
import s from './ui.module.css';

export interface CourseCardProps {
  href: string;
  title: string;
  program: ProgramModule;
  teacherName?: string;
  /** Real cover image (a frame from the course video). Falls back to the program colour + Hanzi. */
  coverUrl?: string | null;
  coverHan?: string;
  isFree?: boolean;
  /** Integer VND; omit while the course has no price. */
  priceVnd?: number | null;
  ratingValue?: number | null;
  ratingSource?: string | null;
  featured?: boolean;
  meta?: string;
  /** Learner progress (my courses): 0–100 plus the text under the bar. */
  progress?: { percent: number; label: string };
}

/** Course card: 16:9 cover, title, teacher, sourced rating, price, badge. */
export function CourseCard({
  href,
  title,
  program,
  teacherName,
  coverUrl,
  coverHan,
  isFree,
  priceVnd,
  ratingValue,
  ratingSource,
  featured,
  meta,
  progress,
}: CourseCardProps) {
  const { getProgram } = usePrograms();
  const p = getProgram(program);
  const price = isFree ? 'Miễn phí' : priceVnd != null ? formatVnd(priceVnd) : null;
  return (
    <Link href={href} className={s.card}>
      <div className={s.cover} style={{ background: p.color }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" loading="lazy" />
        ) : (
          <span className={s.coverHan} aria-hidden="true">
            {coverHan ?? p.han}
          </span>
        )}
      </div>
      <span className={s.cardTitle}>{title}</span>
      {teacherName && <span className={s.cardMeta}>GV {teacherName}</span>}
      <Rating value={ratingValue} source={ratingSource} />
      {meta && <span className={s.cardMeta}>{meta}</span>}
      {price && <span className={s.cardPrice}>{price}</span>}
      {featured && <Badge tone="featured">Nổi bật</Badge>}
      {progress && (
        <span className={s.cardProgress}>
          <ProgressBar value={progress.percent} label={`Tiến độ ${title}`} />
          <span className={s.cardMeta}>{progress.label}</span>
        </span>
      )}
    </Link>
  );
}
