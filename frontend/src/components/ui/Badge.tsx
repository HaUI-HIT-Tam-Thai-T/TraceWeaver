import type { HTMLAttributes } from 'react';
import { Badge as ShadcnBadge } from './primitives/badge';
import { cn } from '../../lib/utils';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
};

const tones = {
  neutral: 'text-muted', info: 'text-focus', success: 'text-success',
  warning: 'text-warning', danger: 'text-danger',
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return <ShadcnBadge {...props} variant="ghost"
    className={cn('rounded-md border-0 bg-transparent px-2 py-1 font-semibold motion-reduce:transition-none', tones[tone], className)} />;
}
