import { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFocusable, trapTab, useFocusScope } from './popup';

interface DialogProps {
  title: React.ReactNode;
  onClose: () => void;
  /** Tailwind width classes; the panel never exceeds the viewport (`max-w-full`). */
  width?: string;
  maxHeight?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** First field of the body (or `[data-autofocus]`); the close button only when nothing else is focusable. */
function pickInitialFocus(root: HTMLElement): HTMLElement | null {
  const preferred = root.querySelector<HTMLElement>('[data-autofocus]');
  if (preferred) return preferred;
  const focusable = getFocusable(root);
  return focusable.find((el) => !el.hasAttribute('data-dialog-close')) ?? focusable[0] ?? null;
}

/**
 * Modal dialog: `role="dialog"` labelled by its title, focus moves in on open, is trapped, and is
 * restored to the trigger on close. Escape and a click on the backdrop close it.
 */
export function Dialog({ title, onClose, width = 'w-[420px]', maxHeight, footer, children, className = '' }: DialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusScope(panelRef, pickInitialFocus);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (panelRef.current) trapTab(e, panelRef.current);
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* The dialog itself handles Escape and the Tab trap; its controls are the interactive parts. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex max-h-full max-w-full flex-col bg-card border rounded-lg shadow-xl focus:outline-none ${width} ${maxHeight ?? ''} ${className}`}
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <h2 id={titleId} className="min-w-0 text-lg font-semibold">{title}</h2>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            aria-label={t('app.close')}
            className="inline-flex shrink-0 items-center justify-center hover:bg-accent rounded p-1 pointer-coarse:size-11"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">{children}</div>

        {footer && <div className="p-4 border-t">{footer}</div>}
      </div>
    </div>
  );
}
