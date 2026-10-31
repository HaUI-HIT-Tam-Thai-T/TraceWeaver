import axios from "axios";
import { ApiError, normalizeApiError } from "../../../services/apiError.ts";
import type { WorkspaceAdminService } from "./workspaceAdminService.ts";
import {
  accountFormSchema,
  addMemberSchema,
  updateMemberSchema,
  sourceGrantSchema,
} from "./schemas.ts";
import type {
  Member,
  AccountForm,
  AddMember,
  UpdateMember,
  SourceGrant,
  Completed,
  AdminRole,
} from "./schemas.ts";

export type AdminScope = { subject: string; wid: string; accessKey: object; sourceIds: string[] };
type Feedback = {
  status: "idle" | "sending" | "success" | "error" | "conflict" | "uncertain";
  error: ApiError | null;
};
export type AdminState = {
  scope: AdminScope | null;
  epoch: number;
  blocked: boolean;
  list: {
    status: "idle" | "loading" | "ready" | "error";
    items: Member[];
    version: number | null;
    next: string | null;
    error: ApiError | null;
  };
  mutation: Feedback;
  account: {
    status: "idle" | "sending" | "error" | "pending" | "uncertain" | "completed";
    key: string | null;
    username: string | null;
    roles: AdminRole[];
    error: ApiError | null;
    rejection: ApiError | null;
    result: Completed | null;
  };
};
export const initialAdminState = (scope: AdminScope | null = null, epoch = 0): AdminState => ({
  scope,
  epoch,
  blocked: false,
  list: { status: "idle", items: [], version: null, next: null, error: null },
  mutation: { status: "idle", error: null },
  account: {
    status: "idle",
    key: null,
    username: null,
    roles: [],
    error: null,
    rejection: null,
    result: null,
  },
});
const fail = (code: string, message: string) => new ApiError({ kind: "client", code, message });
export function createAdminController(
  service: WorkspaceAdminService,
  refreshAccess: () => Promise<void>,
  newKey = () => crypto.randomUUID(),
) {
  let state = initialAdminState(),
    generation = 0,
    busy = false;
  let request: AbortController | null = null;
  const listeners = new Set<() => void>();
  function update(patch: Partial<AdminState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }
  function abort() {
    generation++;
    request?.abort();
    busy = false;
  }
  function reset(scope: AdminScope | null) {
    abort();
    state = initialAdminState(scope, generation);
    listeners.forEach((listener) => listener());
  }
  function deny(error: ApiError) {
    const scope = state.scope;
    reset(scope);
    update({ blocked: true, list: { ...state.list, status: "error", error } });
    if (error.kind !== "auth") void refreshAccess().catch(() => undefined);
  }
  function denied(error: ApiError) {
    return error.kind === "auth" || error.status === 403 || error.status === 404;
  }
  function begin() {
    const controller = new AbortController(),
      version = generation;
    request = controller;
    busy = true;
    return {
      signal: controller.signal,
      current: () => version === generation && !controller.signal.aborted && request === controller,
    };
  }
  async function load(more = false): Promise<void> {
    if (
      !state.scope ||
      busy ||
      state.blocked ||
      (more && (!state.list.next || state.list.status !== "ready"))
    )
      return;
    const scope = state.scope,
      previous = state.list;
    const flight = begin();
    update({ list: { ...previous, status: "loading", error: null } });
    try {
      const page = await service.list(
        scope.wid,
        more ? (previous.next ?? undefined) : undefined,
        flight.signal,
      );
      if (!flight.current()) return;
      if (more && page.version !== previous.version)
        throw fail(
          "ADMIN_PAGE_CHANGED",
          "Danh sách đã thay đổi giữa các trang. Tải lại từ trang đầu trước khi thao tác.",
        );
      if (
        more &&
        page.items.some((item) => previous.items.some((old) => old.subject === item.subject))
      )
        throw fail(
          "INVALID_API_RESPONSE",
          "Danh sách trả thành viên trùng giữa các trang. Hãy tải lại.",
        );
      update({
        list: {
          status: "ready",
          items: more ? [...previous.items, ...page.items] : page.items,
          version: page.version,
          next: page.next_after,
          error: null,
        },
      });
    } catch (error: unknown) {
      if (!flight.current()) return;
      const safe = normalizeApiError(error);
      if (denied(safe)) deny(safe);
      else update({ list: { status: "error", items: [], version: null, next: null, error: safe } });
    } finally {
      if (flight.current()) busy = false;
    }
  }
  function sync(scope: AdminScope | null) {
    const old = state.scope;
    if (!scope) {
      if (old) reset(null);
      return;
    }
    if (
      old?.subject === scope.subject &&
      old.wid === scope.wid &&
      old.accessKey === scope.accessKey &&
      old.sourceIds.join() === scope.sourceIds.join()
    )
      return;
    reset(scope);
    void load();
  }
  type Mutation =
    | { kind: "add"; body: AddMember }
    | { kind: "update"; subject: string; body: UpdateMember }
    | { kind: "grant"; subject: string; sid: string; body: SourceGrant };
  async function mutate(input: Mutation): Promise<void> {
    if (busy || state.blocked || !state.scope || state.list.status !== "ready") return;
    const parsed =
      input.kind === "add"
        ? addMemberSchema.safeParse(input.body)
        : input.kind === "update"
          ? updateMemberSchema.safeParse(input.body)
          : sourceGrantSchema.safeParse(input.body);
    if (!parsed.success) return;
    if (input.body.expected_version !== state.list.version) {
      update({
        mutation: {
          status: "conflict",
          error: fail("VERSION_CONFLICT", "Đọc phiên bản mới và xác nhận lại trước khi gửi."),
        },
      });
      return;
    }
    const member =
      input.kind === "add"
        ? undefined
        : state.list.items.find((item) => item.subject === input.subject);
    if (input.kind !== "add" && (!member || member.roles.includes("ingest_service"))) return;
    if (input.kind === "grant" && (!state.scope.sourceIds.includes(input.sid) || !member?.active))
      return;
    const scope = state.scope,
      flight = begin();
    update({ mutation: { status: "sending", error: null } });
    let self = false;
    try {
      if (input.kind === "add") await service.add(scope.wid, input.body, flight.signal);
      else if (input.kind === "update") {
        await service.update(scope.wid, input.subject, input.body, flight.signal);
        self = input.subject === scope.subject;
      } else {
        await service.grant(scope.wid, input.subject, input.sid, input.body, flight.signal);
        self = input.subject === scope.subject;
      }
      if (!flight.current()) return;
      update({ mutation: { status: "success", error: null } });
    } catch (error: unknown) {
      if (!flight.current()) return;
      const safe = normalizeApiError(error);
      if (denied(safe)) {
        deny(safe);
        return;
      }
      const uncertain =
        axios.isCancel(error) ||
        safe.kind === "timeout" ||
        safe.kind === "network" ||
        safe.code === "INVALID_API_RESPONSE" ||
        (safe.status ?? 0) >= 500;
      update({
        mutation: {
          status: safe.code === "VERSION_CONFLICT" ? "conflict" : uncertain ? "uncertain" : "error",
          error: safe,
        },
      });
      self = input.kind !== "add" && input.subject === scope.subject && uncertain;
    } finally {
      if (flight.current()) busy = false;
    }
    if (!flight.current()) return;
    if (self) {
      reset(null);
      await refreshAccess().catch(() => undefined);
      return;
    }
    await load();
  }
  async function createAccount(input: AccountForm, expected: number): Promise<void> {
    if (
      !state.scope ||
      busy ||
      state.blocked ||
      state.list.status !== "ready" ||
      state.account.status === "completed" ||
      state.account.rejection ||
      !accountFormSchema.safeParse(input).success
    )
      return;
    if (expected !== state.list.version) return;
    const previous = state.account;
    if (
      previous.key &&
      (previous.username !== input.username ||
        previous.roles.length !== input.roles.length ||
        previous.roles.some((role, index) => role !== input.roles[index]))
    )
      return;
    const key = previous.key ?? newKey(),
      scope = state.scope,
      token = generation,
      flight = begin();
    update({
      account: {
        ...previous,
        status: "sending",
        key,
        username: input.username,
        roles: [...input.roles],
        error: null,
      },
    });
    try {
      const result = await service.createAccount(
        scope.wid,
        { ...input, expected_version: expected },
        key,
        flight.signal,
      );
      if (!flight.current()) return;
      update({
        account: { ...state.account, status: "completed", result, error: null, rejection: null },
      });
    } catch (error: unknown) {
      if (!flight.current()) return;
      const safe = normalizeApiError(error);
      if (denied(safe)) {
        deny(safe);
        return;
      }
      const pending = safe.code === "ACCOUNT_PROVISIONING_PENDING";
      const uncertain =
        axios.isCancel(error) ||
        safe.kind === "network" ||
        safe.kind === "timeout" ||
        safe.code === "INVALID_API_RESPONSE" ||
        ((safe.status ?? 0) >= 500 && safe.code !== "ACCOUNT_PROVIDER_DISABLED");
      const rejection = ["ACCOUNT_POLICY_REJECTED", "ACCOUNT_OWNERSHIP_CONFLICT"].includes(
        safe.code,
      )
        ? safe
        : state.account.rejection;
      update({
        account: {
          ...state.account,
          status: pending ? "pending" : uncertain ? "uncertain" : "error",
          error: safe,
          rejection,
          ...(safe.code === "ACCOUNT_PROVIDER_DISABLED" && !previous.key ? { key: null } : {}),
        },
      });
    } finally {
      if (flight.current()) busy = false;
    }
    if (!flight.current()) return;
    const status = state.account.status;
    await load();
    if (generation === token && !state.blocked && (status === "pending" || status === "uncertain"))
      await checkOperation();
  }
  async function checkOperation(): Promise<void> {
    if (
      !state.scope ||
      busy ||
      state.blocked ||
      !state.account.key ||
      state.account.status === "completed"
    )
      return;
    const scope = state.scope,
      key = state.account.key,
      flight = begin();
    update({ account: { ...state.account, status: "sending", error: null } });
    try {
      const operation = await service.operation(scope.wid, key, flight.signal);
      if (!flight.current()) return;
      if (
        operation.username !== state.account.username ||
        (operation.state === "completed" &&
          (operation.roles.length !== state.account.roles.length ||
            operation.roles.some((role) => !state.account.roles.includes(role))))
      )
        throw fail("INVALID_API_RESPONSE", "Operation không khớp tài khoản đang tạo.");
      update({
        account: {
          ...state.account,
          status: operation.state,
          result: operation.state === "completed" ? operation : null,
          error: null,
          rejection: operation.state === "completed" ? null : state.account.rejection,
        },
      });
    } catch (error: unknown) {
      if (!flight.current()) return;
      const safe = normalizeApiError(error);
      if (denied(safe)) {
        deny(safe);
        return;
      }
      update({ account: { ...state.account, status: "uncertain", error: safe } });
    } finally {
      if (flight.current()) busy = false;
    }
    if (flight.current()) await load();
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    sync,
    refresh: () => load(),
    more: () => load(true),
    mutate,
    createAccount,
    checkOperation,
    resetAccount() {
      if (!busy && (!state.account.key || state.account.status === "completed"))
        update({ account: initialAdminState().account });
    },
    stop() {
      reset(null);
    },
  };
}
export type AdminController = {
  getSnapshot: () => AdminState;
  subscribe: (listener: () => void) => () => void;
  sync: (scope: AdminScope | null) => void;
  refresh: () => Promise<void>;
  more: () => Promise<void>;
  mutate: (
    input:
      | { kind: "add"; body: AddMember }
      | { kind: "update"; subject: string; body: UpdateMember }
      | { kind: "grant"; subject: string; sid: string; body: SourceGrant },
  ) => Promise<void>;
  createAccount: (input: AccountForm, expected: number) => Promise<void>;
  checkOperation: () => Promise<void>;
  resetAccount: () => void;
  stop: () => void;
};
