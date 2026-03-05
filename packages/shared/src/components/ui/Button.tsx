import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size = 'default' | 'sm' | 'xs';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border hover:bg-accent',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
  ghost: 'hover:bg-accent',
};

const sizeClasses: Record<Size, string> = {
  default: 'h-8 px-4 text-sm',
  sm: 'h-7 px-3 text-xs',
  xs: 'h-6 px-2 text-xs',
};

export function Button({ variant = 'secondary', size = 'default', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    />
  );
}
