import type { HTMLAttributes, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { Table as ShadcnTable, TableCaption, TableHeader as ShadcnTableHeader, TableBody as ShadcnTableBody, TableRow as ShadcnTableRow, TableHead as ShadcnTableHead, TableCell as ShadcnTableCell } from './primitives/table';
import { cn } from '../../lib/utils';

type TableProps = TableHTMLAttributes<HTMLTableElement> & { caption: string; hideCaption?: boolean };

export function Table({ caption, hideCaption = true, children, className, ...props }: TableProps) {
  return <ShadcnTable aria-label={caption} {...props} className={cn('min-w-[36rem] caption-top border-collapse text-left', className)}
    containerProps={{ tabIndex: 0, role: 'region', 'aria-label': caption, className: 'rounded-md border border-line' }}>
    {!hideCaption && <TableCaption className="m-0 px-4 py-3 text-left font-medium">{caption}</TableCaption>}
    {children}
  </ShadcnTable>;
}
export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <ShadcnTableHeader {...props} />;
}
export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <ShadcnTableBody {...props} />;
}
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <ShadcnTableRow {...props} className={cn('border-line hover:bg-control/30 motion-reduce:transition-none', className)} />;
}
export function TableHead({ scope = 'col', className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <ShadcnTableHead {...props} scope={scope} className={cn('border-y border-line bg-control px-4 py-3 text-center font-semibold', className)} />;
}
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <ShadcnTableCell {...props} className={cn('whitespace-normal px-4 py-3 align-top', className)} />;
}
