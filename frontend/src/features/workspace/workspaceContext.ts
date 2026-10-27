import { createContext, useContext } from 'react'
import type { WorkspaceController } from './controller'
import type { Membership } from './schemas'
import type { WorkspaceState, workspacePermissions } from './state'

export type WorkspaceContextValue = Pick<WorkspaceController, 'selectWorkspace' | 'refreshAccess' | 'loadMoreSources'> & {
  state: WorkspaceState
  membership: Membership | null
  permissions: ReturnType<typeof workspacePermissions>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}
