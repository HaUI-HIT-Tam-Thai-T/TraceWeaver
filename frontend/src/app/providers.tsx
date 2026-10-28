import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/state/AuthProvider";
import { WorkspaceProvider } from "../features/workspace/state/WorkspaceProvider";
import { EventsProvider } from "../features/events/state/EventsProvider";
import { CasesProvider } from "../features/cases/state/CasesProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <EventsProvider>
            <CasesProvider>{children}</CasesProvider>
          </EventsProvider>
        </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
