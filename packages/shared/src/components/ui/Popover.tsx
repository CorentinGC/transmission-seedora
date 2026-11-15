import { useRef } from 'react';
import { getFocusable, useClampedPosition, useFocusScope, useOutsidePointerDown } from './popup';

interface PopoverProps {
  x: number;
  y: number;
  /** Accessible name of the popover. */
  label: string;
  onClose: () => void;
  /** `above-center` centres the popover on the anchor and opens it upwards. */
  placement?: 'below' | 'above-center';
  className?: string;
  children: React.ReactNode;
}

/**
 * Non-modal popover with form controls. Escape, a pointer press outside, or Tab leaving it closes
 * it, and focus returns to the trigger.
 */
export function Popover({ x, y, label, onClose, placement = 'below', className = '', children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useClampedPosition(ref, { x, y }, placement);
  useFocusScope(ref, (root) => getFocusable(root)[0]);
  useOutsidePointerDown(ref, onClose);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && !e.currentTarget.contains(next)) onClose();
      }}
      className={`fixed z-50 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-md border bg-popover shadow-lg text-sm focus:outline-none ${className}`}
      style={{ left: pos.left, top: pos.top }}
    >
      {children}
    </div>
  );
}
