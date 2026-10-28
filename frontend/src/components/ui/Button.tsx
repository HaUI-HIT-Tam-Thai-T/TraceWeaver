import type { ButtonHTMLAttributes } from 'react';
import { Button as ShadcnButton } from './primitives/button';
import { cn } from '../../lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({ variant = 'primary', loading = false, disabled, type = 'button', className, children, ...props }: ButtonProps) {
  const shadcnVariant = variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : variant;
  return (
    <ShadcnButton {...props} type={type} variant={shadcnVariant} disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('min-h-10 h-auto whitespace-normal py-2 font-semibold motion-reduce:transition-none',
        variant === 'primary' && 'hover:bg-primary-hover',
        variant === 'danger' && 'border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20', className)}>
      {children}
    </ShadcnButton>
  );
}
