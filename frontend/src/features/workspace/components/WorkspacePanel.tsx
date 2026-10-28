import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Badge } from "../../../components/ui/Badge";
import { LoadingState } from "../../../components/ui/LoadingState";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import type { ApiError } from "../../../services/apiError";
import { useAuth } from "../../auth/hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";

function ErrorMessage({ error }: { error: ApiError }) {
  return <ErrorState message={error.message} requestId={error.requestId} />;
}

export function WorkspacePanel() {
  const { state: auth, signIn } = useAuth();
  const {
    state,
    membership,
    permissions,
    selectWorkspace,
    refreshAccess,
    loadMoreSources,
  } = useWorkspace();
  const [signingIn, setSigningIn] = useState(false);
  if (auth.status !== "authenticated") return null;

  async function loginAgain() {
    setSigningIn(true);
    try {
      await signIn();
    } finally {
      setSigningIn(false);
    }
  }

  if (state.status === "idle" || state.status === "loading")
    return (
      <LoadingState message="Đang kiểm tra workspace và quyền truy cập…" />
    );
  if (state.status === "error" || state.status === "reauth") {
    return (
      <section className="ui-panel space-y-3" aria-label="Workspace">
        {state.error && <ErrorMessage error={state.error} />}
        {state.status === "reauth" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={signingIn}
            onClick={() => {
              void loginAgain();
            }}
          >
            Đăng nhập lại
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void refreshAccess();
            }}
          >
            Thử lại
          </Button>
        )}
      </section>
    );
  }
  const memberships = state.me?.memberships ?? [];
  const sources = state.sources;
  return (
    <section className="ui-panel min-w-0 space-y-4" aria-labelledby="workspace-title">
      <h2 id="workspace-title" className="type-h2">
        Workspace
      </h2>
      {memberships.length === 0 ? (
        <EmptyState title="Tài khoản chưa được cấp workspace." />
      ) : (
        <div className="space-y-2">
          <label htmlFor="workspace-picker" className="type-label block">
            Chọn workspace
          </label>
          <Select
            id="workspace-picker"
            className="max-w-xl"
            value={state.selectedWorkspaceId ?? ""}
            onChange={(event) => selectWorkspace(event.target.value)}
          >
            <option value="" disabled>
              Chọn một workspace
            </option>
            {memberships.map((item) => (
              <option key={item.workspace_id} value={item.workspace_id}>
                {item.workspace_id}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          void refreshAccess();
        }}
      >
        Làm mới quyền và nguồn
      </Button>
      {membership && (
        <>
          <div className="flex flex-wrap items-center gap-2"><span className="type-body-sm text-muted">Vai trò:</span>{membership.roles.length ? membership.roles.map((role) => <Badge key={role} tone="info">{role}</Badge>) : <Badge>Chưa có vai trò</Badge>}</div>
          <p className="type-body">
            Quyền theo vai trò: đọc {permissions.canRead ? "có" : "không"}, ghi{" "}
            {permissions.canWrite ? "có" : "không"}, xác minh{" "}
            {permissions.canVerify ? "có" : "không"}. Backend vẫn kiểm tra quyền
            trên từng thao tác.
          </p>
          {!permissions.canRead ? (
            <EmptyState title="Workspace này chưa có vai trò đọc dữ liệu." />
          ) : (
            <>
              <h3 className="type-h3">Nguồn được phép đọc</h3>
              {sources.status === "loading" && (
                <LoadingState message="Đang tải nguồn…" />
              )}
              {sources.error && (
                <div className="space-y-2">
                  <ErrorMessage error={sources.error} />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      void refreshAccess();
                    }}
                  >
                    Thử lại
                  </Button>
                </div>
              )}
              {sources.status === "ready" && sources.items.length === 0 && (
                <EmptyState title="Chưa có nguồn nào được phép đọc trong trang này." />
              )}
              {sources.items.length > 0 && (
                <Table caption="Danh sách nguồn được phép đọc">
                  <TableHeader><TableRow><TableHead>Nguồn</TableHead><TableHead>Service</TableHead><TableHead>Parser version</TableHead></TableRow></TableHeader>
                  <TableBody>{sources.items.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell><strong>{source.name}</strong><p className="mt-1"><code className="type-code break-all text-muted">{source.id}</code></p></TableCell>
                      <TableCell>{source.service}</TableCell><TableCell>{source.parser_version}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
              {sources.nextCursor && (
                <Button
                  variant="secondary"
                  type="button"
                  disabled={sources.status === "loading"}
                  onClick={() => {
                    void loadMoreSources();
                  }}
                >
                  Tải thêm nguồn
                </Button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
