import type { InputHTMLAttributes } from 'react';

type Size = 'default' | 'sm' | 'xs';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: Size;
}

const sizeClasses: Record<Size, string> = {
  default: 'h-8 px-2 text-sm',
  sm: 'h-7 px-2 text-sm',
  xs: 'h-6 px-1 text-xs',
};

export function Input({ inputSize = 'default', className = '', ...rest }: InputProps) {
  return (
    <input
      className={`rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring ${sizeClasses[inputSize]} ${className}`}
      {...rest}
    />
  );
}
