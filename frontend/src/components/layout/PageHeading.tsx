import type { ReactNode } from "react";
import { Separator } from "../ui/primitives/separator";

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="type-h1">{title}</h1>
          {description && <p className="type-body-sm max-w-[70ch] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <Separator className="mt-6" />
    </header>
  );
}
