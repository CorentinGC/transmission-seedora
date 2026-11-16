import { useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFocusable, trapTab, useFocusScope } from './popup';

interface SheetProps {
  /** Visible title and accessible name. */
  label: string;
  onClose: () => void;
  /** `left` is a drawer over part of the screen; `full` covers it. */
  side: 'left' | 'full';
  children: React.ReactNode;
}

/** Modal panel for small screens: a drawer or a full-screen sheet with focus handling like `Dialog`. */
export function Sheet({ label, onClose, side, children }: SheetProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(ref, (root) => getFocusable(root)[0]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-40 flex bg-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Escape and the Tab trap are handled on the sheet; its controls are the interactive parts. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
            return;
          }
          if (ref.current) trapTab(e, ref.current);
        }}
        className={`flex h-full flex-col bg-card shadow-xl focus:outline-none ${
          side === 'left' ? 'w-[min(20rem,85vw)] border-r' : 'w-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1">
          <span className="min-w-0 truncate text-sm font-medium">{label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('app.close')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded hover:bg-accent"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
