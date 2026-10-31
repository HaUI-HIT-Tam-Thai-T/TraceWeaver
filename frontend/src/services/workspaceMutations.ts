export function createWorkspaceMutationEvents() {
  const listeners = new Set<(workspaceId: string) => void>();
  return {
    subscribe(listener: (workspaceId: string) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async afterMutation<T>(workspaceId: string, operation: () => Promise<T>): Promise<T> {
      try {
        return await operation();
      } finally {
        listeners.forEach((listener) => {
          try {
            listener(workspaceId);
          } catch {
            listeners.delete(listener);
          }
        });
      }
    },
  };
}
export const workspaceMutations = createWorkspaceMutationEvents();
