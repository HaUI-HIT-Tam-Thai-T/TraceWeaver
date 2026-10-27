import type { ApiError } from '../../services/apiError.ts'
import type { Me, Membership, Source, SourcesPage } from './schemas.ts'

export type WorkspaceState = {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'reauth'
  me: Me | null
  selectedWorkspaceId: string | null
  error: ApiError | null
  sources: {
    status: 'idle' | 'loading' | 'ready' | 'error'
    items: Source[]
    nextCursor: string | null
    error: ApiError | null
  }
}

export function initialWorkspaceState(): WorkspaceState {
  return {
    status: 'idle', me: null, selectedWorkspaceId: null, error: null,
    sources: { status: 'idle', items: [], nextCursor: null, error: null },
  }
}

export type WorkspaceAction =
  | { type: 'reset' | 'accessLoading' }
  | { type: 'accessReady'; me: Me; selectedWorkspaceId: string | null }
  | { type: 'accessError'; error: ApiError; reauth: boolean }
  | { type: 'select'; workspaceId: string }
  | { type: 'sourcesLoading' }
  | { type: 'sourcesReady'; page: SourcesPage; append: boolean }
  | { type: 'sourcesError'; error: ApiError }
  | { type: 'sourcesCanceled' }

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'reset': return initialWorkspaceState()
    case 'accessLoading': return { ...initialWorkspaceState(), status: 'loading' }
    case 'accessReady': return {
      ...initialWorkspaceState(), status: 'ready', me: action.me, selectedWorkspaceId: action.selectedWorkspaceId,
    }
    case 'accessError': return { ...initialWorkspaceState(), status: action.reauth ? 'reauth' : 'error', error: action.error }
    case 'select': return { ...state, selectedWorkspaceId: action.workspaceId, sources: initialWorkspaceState().sources }
    case 'sourcesLoading': return { ...state, sources: { ...state.sources, status: 'loading', error: null } }
    case 'sourcesReady': {
      const items = action.append ? [...state.sources.items, ...action.page.items] : action.page.items
      return { ...state, sources: {
        status: 'ready', items: [...new Map(items.map((source) => [source.id, source])).values()],
        nextCursor: action.page.next_cursor, error: null,
      } }
    }
    case 'sourcesError': return { ...state, sources: { status: 'error', items: [], nextCursor: null, error: action.error } }
    case 'sourcesCanceled': return { ...state, sources: { ...state.sources, status: state.sources.items.length ? 'ready' : 'idle' } }
  }
}

export function activeMembership(state: WorkspaceState): Membership | null {
  if (state.status !== 'ready') return null
  return state.me?.memberships.find((membership) => membership.workspace_id === state.selectedWorkspaceId) ?? null
}

export function workspacePermissions(membership: Membership | null) {
  const roles = membership?.roles ?? []
  return {
    canRead: roles.some((role) => ['viewer', 'operator', 'reviewer', 'admin'].includes(role)),
    canWrite: roles.includes('operator') || roles.includes('reviewer'),
    canVerify: roles.includes('reviewer'),
  }
}
