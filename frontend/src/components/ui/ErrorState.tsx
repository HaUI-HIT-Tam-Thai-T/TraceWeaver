import type { ReactNode } from "react";
import { Alert, AlertTitle, AlertDescription } from "./primitives/alert";

type ErrorStateProps = { message: string; requestId?: string | null; action?: ReactNode };

export function ErrorState({ message, requestId, action }: ErrorStateProps) {
  return (
    <div className="space-y-3">
      <Alert variant="destructive" className="border-danger/40 bg-canvas text-danger">
        <AlertTitle className="line-clamp-none break-words text-base leading-6 font-medium tracking-normal">
          {message}
        </AlertTitle>
        {requestId && (
          <AlertDescription className="break-all text-muted text-xs leading-4 font-normal">
            Mã yêu cầu: {requestId}
          </AlertDescription>
        )}
      </Alert>
      {action}
    </div>
  );
}
