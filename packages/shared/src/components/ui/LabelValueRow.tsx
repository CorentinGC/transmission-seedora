interface RowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function InfoRow({ label, value, className }: RowProps) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 flex-shrink-0">{label}:</span>
      <span className={`truncate ${className ?? ''}`}>{value}</span>
    </div>
  );
}

export function StatRow({ label, value }: RowProps) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono">{value}</span>
    </>
  );
}
