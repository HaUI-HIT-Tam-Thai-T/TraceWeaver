import type { ButtonHTMLAttributes } from 'react';
import { Button as ShadcnButton } from './primitives/button';
import { cn } from '../../lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({ variant = 'primary', loading = false, disabled, type = 'button', className, children, ...props }: ButtonProps) {
  const shadcnVariant = variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : variant === 'tertiary' ? 'outline' : variant;
  return (
    <ShadcnButton {...props} type={type} variant={shadcnVariant} disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('min-h-10 h-auto whitespace-normal py-2 font-semibold motion-reduce:transition-none',
        variant === 'primary' && 'hover:bg-primary-hover',
        className)}>
      {children}
    </ShadcnButton>
  );
}
