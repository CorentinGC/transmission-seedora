import type { InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
}

export function Checkbox({ label, className = '', ...rest }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
