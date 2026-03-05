import { X } from 'lucide-react';

interface DialogProps {
  title: React.ReactNode;
  onClose: () => void;
  width?: string;
  maxHeight?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ title, onClose, width = 'w-[420px]', maxHeight, footer, children, className = '' }: DialogProps) {
  const scrollable = !!maxHeight;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`bg-card border rounded-lg shadow-xl ${width} ${maxHeight ?? ''} ${scrollable ? 'flex flex-col' : ''} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="hover:bg-accent rounded p-1">
            <X size={16} />
          </button>
        </div>

        <div className={`p-4 ${scrollable ? 'flex-1 overflow-auto' : ''}`}>
          {children}
        </div>

        {footer && (
          <div className="p-4 border-t">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
