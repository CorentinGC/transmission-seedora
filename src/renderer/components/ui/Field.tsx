interface FieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
