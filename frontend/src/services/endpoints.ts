function workspace(workspaceId: string): string {
  return `/api/v1/workspaces/${workspaceId}`;
}

function cases(workspaceId: string, caseId?: string): string {
  return `${workspace(workspaceId)}/cases${caseId === undefined ? "" : `/${caseId}`}`;
}

function runs(workspaceId: string, runId?: string): string {
  return `${workspace(workspaceId)}/runs${runId === undefined ? "" : `/${runId}`}`;
}

export const endpoints = {
  me: "/api/v1/me",
  workspace,
  cases,
  runs,
  sources: (workspaceId: string) => `${workspace(workspaceId)}/sources`,
  events: (workspaceId: string, eventId?: string) =>
    `${workspace(workspaceId)}/events${eventId === undefined ? "" : `/${eventId}`}`,
  dashboard: (workspaceId: string) => `${workspace(workspaceId)}/dashboard`,
  knowledge: (workspaceId: string) => `${workspace(workspaceId)}/knowledge`,
  admin: (workspaceId: string) => `${workspace(workspaceId)}/admin`,
  linkReviews: (workspaceId: string, runId: string, linkId?: string) =>
    `${runs(workspaceId, runId)}/links${linkId === undefined ? "" : `/${linkId}/reviews`}`,
};
