import Link from 'next/link';
import { PROGRAMS, formatVnd } from '@/lib/programs';
import type { ProgramModule } from '@/lib/types';
import { Badge, Rating } from './Display';
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
}: CourseCardProps) {
  const p = PROGRAMS[program];
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
    </Link>
  );
}
