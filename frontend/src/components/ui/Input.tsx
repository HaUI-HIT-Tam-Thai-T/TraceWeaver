import type { InputHTMLAttributes, Ref } from 'react';
import { Input as ShadcnInput } from './primitives/input';
import { cn } from '../../lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

// React 19 passes the React Hook Form register() ref through to the native input.
export function Input({ className, ...props }: InputProps) {
  return <ShadcnInput {...props} className={cn('min-h-10 bg-control py-2 md:text-base motion-reduce:transition-none', className)} />;
}
