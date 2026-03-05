import type { SelectHTMLAttributes } from 'react';

type Size = 'default' | 'sm' | 'xs';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: Size;
  children: React.ReactNode;
}

const sizeClasses: Record<Size, string> = {
  default: 'h-8 px-2 text-sm',
  sm: 'h-7 px-2 text-sm',
  xs: 'h-6 px-1 text-xs',
};

export function Select({ selectSize = 'default', className = '', children, ...rest }: SelectProps) {
  return (
    <select
      className={`rounded border bg-background ${sizeClasses[selectSize]} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
