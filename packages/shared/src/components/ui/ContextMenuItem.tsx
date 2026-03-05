interface ContextMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  indent?: boolean;
}

export function ContextMenuItem({ icon, label, onClick, className = '', indent }: ContextMenuItemProps) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-left ${indent ? 'pl-6' : ''} ${className}`}
      onClick={onClick}
    >
      {icon && <span className="w-4">{icon}</span>}
      {!icon && !indent && <span className="w-4" />}
      <span>{label}</span>
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="my-1 border-t" />;
}
