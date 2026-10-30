import type { ReactNode } from "react";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "./primitives/empty";

type EmptyStateProps = { title: string; description?: string; action?: ReactNode };

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Empty className="border border-line bg-canvas p-4 md:p-4">
      <EmptyHeader>
        <EmptyTitle
          role="status"
          className="text-base leading-6 font-medium tracking-normal break-words"
        >
          {title}
        </EmptyTitle>
        {description && (
          <EmptyDescription className="text-sm leading-5 font-normal break-words">
            {description}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
