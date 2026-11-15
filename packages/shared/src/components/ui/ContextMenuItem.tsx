import { Check } from 'lucide-react';

interface ContextMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  indent?: boolean;
  /** Makes the item a checkable one (`menuitemradio`); a check mark shows the current choice. */
  checked?: boolean;
}

/** One entry of a `Menu`: a real button with the ARIA menu-item role, focusable by arrow keys only. */
export function ContextMenuItem({ icon, label, onClick, className = '', indent, checked }: ContextMenuItemProps) {
  const checkable = checked !== undefined;
  return (
    <button
      type="button"
      role={checkable ? 'menuitemradio' : 'menuitem'}
      aria-checked={checkable ? checked : undefined}
      tabIndex={-1}
      className={`w-full flex items-center gap-2 px-3 py-1.5 pointer-coarse:py-3 hover:bg-accent focus:bg-accent focus:outline-none text-left ${indent && !checkable ? 'pl-6' : ''} ${className}`}
      onClick={onClick}
    >
      {checkable ? (
        <span className="w-4 shrink-0">{checked && <Check size={14} aria-hidden="true" />}</span>
      ) : icon ? (
        <span className="w-4 shrink-0" aria-hidden="true">{icon}</span>
      ) : (
        !indent && <span className="w-4 shrink-0" />
      )}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

/** Labelled set of related menu items. */
export function ContextMenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div aria-hidden="true" className="px-2 py-1 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export function ContextMenuSeparator() {
  return <div role="separator" className="my-1 border-t" />;
}
