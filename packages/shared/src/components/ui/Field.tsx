interface FieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Labelled control: the label wraps the control, so it is associated without ids. */
export function Field({ label, children, className = '' }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
