import type { AccordionHeadingLevel } from "./primitives/accordion";
import type { ReactNode } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './primitives/accordion';

export function TechnicalDetails({ title, children, className, headingLevel = 3 }: { title: string; children: ReactNode; className?: string; headingLevel?: AccordionHeadingLevel }) {
  return <Accordion type="single" collapsible className={className}><AccordionItem value="details"><AccordionTrigger headingLevel={headingLevel}>{title}</AccordionTrigger><AccordionContent forceMount className="technical-content space-y-3 break-words">{children}</AccordionContent></AccordionItem></Accordion>;
}
