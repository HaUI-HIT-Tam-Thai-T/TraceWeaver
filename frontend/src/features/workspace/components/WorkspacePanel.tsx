import { Button } from "../../../components/ui/Button";
import { LoadingState } from "../../../components/ui/LoadingState";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../components/ui/Table";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";

// Workspace selection/account controls live in AppHeader; this panel only shows sources.
export function WorkspacePanel() {
  const { state: auth } = useAuth();
  const { state, membership, permissions, refreshAccess, loadMoreSources } = useWorkspace();
  if (
    auth.status !== "authenticated" ||
    state.status !== "ready" ||
    !membership ||
    !permissions.canRead
  )
    return null;
  const sources = state.sources;
  return (
    <section className="ui-panel min-w-0 space-y-4" aria-labelledby="sources-title">
      <h2 id="sources-title" className="type-h2">
        Nguồn được phép đọc
      </h2>
      {sources.status === "loading" && <LoadingState message="Đang tải nguồn…" />}
      {sources.error && (
        <ErrorState
          message={sources.error.message}
          requestId={sources.error.requestId}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void refreshAccess();
              }}
            >
              Thử lại
            </Button>
          }
        />
      )}
      {sources.status === "ready" && sources.items.length === 0 && (
        <EmptyState title="Chưa có nguồn nào được phép đọc trong trang này." />
      )}
      {sources.items.length > 0 && (
        <Table caption="Danh sách nguồn được phép đọc">
          <TableHeader>
            <TableRow>
              <TableHead>Nguồn</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Parser version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.items.map((source) => (
              <TableRow key={source.id}>
                <TableCell>
                  <strong>{source.name}</strong>
                  <p className="mt-1">
                    <code className="type-code break-all text-muted">{source.id}</code>
                  </p>
                </TableCell>
                <TableCell>{source.service}</TableCell>
                <TableCell>{source.parser_version}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {sources.nextCursor && (
        <Button
          variant="secondary"
          disabled={sources.status === "loading"}
          onClick={() => {
            void loadMoreSources();
          }}
        >
          Tải thêm nguồn
        </Button>
      )}
    </section>
  );
}
