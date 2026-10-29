import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';

// Entrance only: removal is immediate, including when access is revoked.
export function SectionReveal({ children, className }: { children: ReactNode; className?: string }) {
  return <MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict><m.div className={className} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>{children}</m.div></LazyMotion></MotionConfig>;
}
