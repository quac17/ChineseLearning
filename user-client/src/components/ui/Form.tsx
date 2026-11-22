'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import s from './ui.module.css';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** One control: Input, Textarea or Select. It receives id, aria-describedby and aria-invalid. */
  children: ReactElement;
  className?: string;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;
  const controlId = (isValidElement(children) && (children.props as { id?: string }).id) || id;

  return (
    <div className={[s.field, className].filter(Boolean).join(' ')}>
      <label className={s.label} htmlFor={controlId}>
        {label}
      </label>
      {control}
      {error && (
        <span id={errorId} className={s.error}>
          {error}
        </span>
      )}
      {hint && (
        <span id={hintId} className={s.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[s.control, className].filter(Boolean).join(' ')} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={[s.control, className].filter(Boolean).join(' ')} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={[s.control, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
}

export function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Pill search box. Pass `label` for the (visually hidden) accessible name. */
export function SearchInput({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className={[s.search, className].filter(Boolean).join(' ')}>
      <label htmlFor={rest.id ?? id} className="sr-only">
        {label}
      </label>
      <span className={s.searchIcon}>
        <SearchIcon />
      </span>
      <input id={rest.id ?? id} type="search" className={s.control} {...rest} />
    </div>
  );
}

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode };

export function Checkbox({ label, className, ...rest }: ChoiceProps) {
  return (
    <label className={[s.choice, className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ label, className, ...rest }: ChoiceProps) {
  return (
    <label className={[s.choice, className].filter(Boolean).join(' ')}>
      <input type="radio" {...rest} />
      <span>{label}</span>
    </label>
  );
}

interface SwitchProps {
  label: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, checked, onChange, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className={s.switchRow}>
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className={s.switch}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className={s.switchKnob} />
      </button>
    </div>
  );
}
