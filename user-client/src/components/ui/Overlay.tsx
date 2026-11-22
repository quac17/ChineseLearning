'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import s from './ui.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned. Put the cancel action first. */
  actions?: ReactNode;
}

/** Modal dialog on the native <dialog> element (focus trap, Esc, backdrop). */
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={s.dialogBody}>
        <h2 id="dialog-title" style={{ fontSize: 20, fontWeight: 800 }}>
          {title}
        </h2>
        {children}
        {actions && <div className={s.dialogActions}>{actions}</div>}
      </div>
    </dialog>
  );
}

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastApi {
  show: (message: string, opts?: { actionLabel?: string; onAction?: () => void; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, opts) => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction }]);
      window.setTimeout(() => dismiss(id), opts?.durationMs ?? 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={s.toasts} aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={s.toast} role="status">
            <span>{t.message}</span>
            {t.actionLabel ? (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel}
              </button>
            ) : (
              <button type="button" aria-label="Đóng thông báo" onClick={() => dismiss(t.id)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
