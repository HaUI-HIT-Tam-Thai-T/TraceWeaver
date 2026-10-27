import { useState } from "react";
import type { ApiError } from "../../services/apiError";
import { useAuth } from "../auth/authContext";
import { useWorkspace } from "./workspaceContext";

function ErrorMessage({ error }: { error: ApiError }) {
  return (
    <p role="alert">
      {error.message}
      {error.requestId && <> Mã yêu cầu: {error.requestId}</>}
    </p>
  );
}

const buttonClass =
  "rounded border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

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
      <p className="mt-6" role="status">
        Đang kiểm tra workspace và quyền truy cập…
      </p>
    );
  if (state.status === "error" || state.status === "reauth") {
    return (
      <section className="mt-6 space-y-3" aria-label="Workspace">
        {state.error && <ErrorMessage error={state.error} />}
        {state.status === "reauth" ? (
          <button
            type="button"
            className={buttonClass}
            disabled={signingIn}
            onClick={() => {
              void loginAgain();
            }}
          >
            Đăng nhập lại
          </button>
        ) : (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              void refreshAccess();
            }}
          >
            Thử lại
          </button>
        )}
      </section>
    );
  }
  const memberships = state.me?.memberships ?? [];
  const sources = state.sources;
  return (
    <section className="mt-6 space-y-4" aria-labelledby="workspace-title">
      <h2 id="workspace-title" className="text-xl font-semibold">
        Workspace
      </h2>
      {memberships.length === 0 ? (
        <p role="status">Tài khoản chưa được cấp workspace.</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor="workspace-picker" className="block">
            Chọn workspace
          </label>
          <select
            id="workspace-picker"
            className="w-full max-w-xl rounded border p-2 focus-visible:outline-2"
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
          </select>
        </div>
      )}
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          void refreshAccess();
        }}
      >
        Làm mới quyền và nguồn
      </button>
      {membership && (
        <>
          <p>Vai trò: {membership.roles.join(", ") || "Chưa có vai trò"}.</p>
          <p>
            Quyền theo vai trò: đọc {permissions.canRead ? "có" : "không"}, ghi{" "}
            {permissions.canWrite ? "có" : "không"}, xác minh{" "}
            {permissions.canVerify ? "có" : "không"}. Backend vẫn kiểm tra quyền
            trên từng thao tác.
          </p>
          {!permissions.canRead ? (
            <p role="status">Workspace này chưa có vai trò đọc dữ liệu.</p>
          ) : (
            <>
              <h3 className="font-semibold">Nguồn được phép đọc</h3>
              {sources.status === "loading" && (
                <p role="status">Đang tải nguồn…</p>
              )}
              {sources.error && (
                <div className="space-y-2">
                  <ErrorMessage error={sources.error} />
                  <button
                    className={buttonClass}
                    type="button"
                    onClick={() => {
                      void refreshAccess();
                    }}
                  >
                    Thử lại
                  </button>
                </div>
              )}
              {sources.status === "ready" && sources.items.length === 0 && (
                <p role="status">
                  Chưa có nguồn nào được phép đọc trong trang này.
                </p>
              )}
              <ul className="space-y-2">
                {sources.items.map((source) => (
                  <li className="break-words" key={source.id}>
                    <strong>{source.name}</strong> — {source.service} ·{" "}
                    {source.parser_version}
                    <br />
                    <span>{source.id}</span>
                  </li>
                ))}
              </ul>
              {sources.nextCursor && (
                <button
                  className={buttonClass}
                  type="button"
                  disabled={sources.status === "loading"}
                  onClick={() => {
                    void loadMoreSources();
                  }}
                >
                  Tải thêm nguồn
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
