'use client';

import { useRef, type KeyboardEvent } from 'react';
import s from './ui.module.css';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** underline: page sections. segmented: small filters (app, quiz). */
  variant?: 'underline' | 'segmented';
  /** Prefix for tab/panel ids, so panels can use aria-labelledby={`${idPrefix}-${id}`}. */
  idPrefix?: string;
}

/** Tab list with roving focus (arrow keys, Home, End). Render the panels yourself. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'underline',
  idPrefix = 'tab',
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((t) => t.id === value);
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  const isSeg = variant === 'segmented';
  return (
    <div role="tablist" aria-label={label} className={isSeg ? s.segmented : s.tabs} onKeyDown={onKeyDown}>
      {items.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className={isSeg ? s.segment : s.tab}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
