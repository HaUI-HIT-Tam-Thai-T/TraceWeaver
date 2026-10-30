import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  adminRoleSchema,
  accountFormSchema,
  addMemberSchema,
  updateMemberSchema,
} from "../schemas";
import type { AccountForm, AddMember, UpdateMember, Member, AdminRole } from "../schemas";
import type { AdminController, AdminState } from "../controller";
import { roleLabel } from "../../workspace/presentation";
import { adminError } from "../presentation";
import type { ApiError } from "../../../services/apiError";

export function AdminFailure({ error }: { error: ApiError | null }) {
  return (
    error && (
      <div role="alert" className="ui-panel border-danger/40 text-danger">
        <p>{adminError(error)}</p>
        <details>
          <summary>Mã tra cứu</summary>
          <p>
            {error.code}
            {error.requestId ? ` · ${error.requestId}` : ""}
          </p>
        </details>
      </div>
    )
  );
}
export function RoleOptions({
  value,
  onChange,
  disabled = false,
}: {
  value: AdminRole[];
  onChange: (roles: AdminRole[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-wrap gap-4">
      <legend className="type-label mb-2">Vai trò</legend>
      {adminRoleSchema.options.map((role) => (
        <label key={role} className="inline-flex min-h-10 items-center gap-2">
          <input
            type="checkbox"
            checked={value.includes(role)}
            onChange={(event) =>
              onChange(
                event.target.checked ? [...value, role] : value.filter((item) => item !== role),
              )
            }
          />
          {roleLabel(role)}
        </label>
      ))}
    </fieldset>
  );
}
export function VersionChoice({
  selected,
  current,
  choose,
  disabled,
}: {
  selected: number;
  current: number;
  choose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <details>
        <summary>Phiên bản quản trị</summary>
        <p>
          Đang dùng {selected}; dữ liệu vừa đọc: {current}.
        </p>
      </details>
      {selected !== current && (
        <div role="status">
          <p>Dữ liệu đã thay đổi. Đọc danh sách mới trước khi gửi tiếp.</p>
          <Button type="button" variant="secondary" disabled={disabled} onClick={choose}>
            Dùng phiên bản quản trị mới
          </Button>
        </div>
      )}
    </div>
  );
}
export type MemberDraft = AddMember & { active: boolean };
export function MemberForm({
  member,
  version,
  disabled,
  controller,
  draft,
  onDraft,
  hideTitle = false,
}: {
  member?: Member;
  version: number;
  disabled: boolean;
  controller: AdminController;
  draft?: MemberDraft;
  onDraft?: (draft: MemberDraft) => void;
  hideTitle?: boolean;
}) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const editing = member !== undefined;
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddMember>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      subject: draft?.subject ?? member?.subject ?? "",
      roles: draft?.roles ??
        member?.roles.filter(
          (role): role is AdminRole => adminRoleSchema.safeParse(role).success,
        ) ?? ["viewer"],
      expected_version: draft?.expected_version ?? version,
    },
  });
  const [active, setActive] = useState(draft?.active ?? member?.active ?? true);
  const selectedVersion = useWatch({ control, name: "expected_version" }),
    roles = useWatch({ control, name: "roles" });
  const subject = useWatch({ control, name: "subject" });
  useEffect(() => {
    onDraft?.({ subject, roles, expected_version: selectedVersion, active });
  }, [onDraft, subject, roles, selectedVersion, active]);
  const busy = disabled || isSubmitting;
  async function submit(values: AddMember) {
    if (editing) {
      if (!active && member?.active && !confirmRevoke) {
        setConfirmRevoke(true);
        return;
      }
      const body: UpdateMember = {
        roles: values.roles,
        active,
        expected_version: values.expected_version,
      };
      if (!updateMemberSchema.safeParse(body).success || !member) return;
      await controller.mutate({ kind: "update", subject: member.subject, body });
    } else await controller.mutate({ kind: "add", body: values });
    if (controller.getSnapshot().mutation.status === "success") {
      if (!editing)
        reset({
          subject: "",
          roles: ["viewer"],
          expected_version: controller.getSnapshot().list.version ?? version,
        });
      setConfirmRevoke(false);
    }
  }
  return (
    <form
      aria-label={editing ? "Sửa thành viên" : "Thêm người đã có SSO"}
      className={hideTitle ? "space-y-4" : "ui-panel space-y-4"}
      onSubmit={handleSubmit(submit)}
    >
      {!hideTitle && (
        <h2 className="type-h2">{editing ? "Sửa thành viên" : "Thêm người đã có SSO"}</h2>
      )}
      <fieldset disabled={busy} className="space-y-3">
        <label className="type-label block">
          Subject Keycloak
          <Input
            {...register("subject")}
            readOnly={editing}
            maxLength={255}
            aria-invalid={!!errors.subject}
          />
        </label>
        {errors.subject && <p role="alert">{errors.subject.message}</p>}
        <RoleOptions
          value={roles}
          onChange={(next) => setValue("roles", next, { shouldValidate: true })}
        />
        {errors.roles && <p role="alert">Chọn ít nhất một vai trò, không trùng.</p>}
        {editing && (
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => {
                setActive(event.target.checked);
                setConfirmRevoke(false);
              }}
            />
            Membership đang hoạt động
          </label>
        )}
        <input type="hidden" {...register("expected_version", { valueAsNumber: true })} />
        <VersionChoice
          selected={selectedVersion}
          current={version}
          disabled={busy}
          choose={() => {
            setValue("expected_version", version);
            setConfirmRevoke(false);
          }}
        />
        {confirmRevoke && (
          <div role="alert" className="space-y-2">
            <p>
              Xác nhận thu hồi membership của {member?.subject} trong workspace đang chọn. Tài khoản
              SSO không bị xóa hoặc khóa.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setActive(true);
                setConfirmRevoke(false);
              }}
            >
              Giữ membership hoạt động
            </Button>
          </div>
        )}
        <Button
          variant={editing && !active ? "danger" : "primary"}
          type="submit"
          disabled={selectedVersion !== version}
        >
          {confirmRevoke
            ? "Xác nhận thu hồi membership"
            : editing
              ? "Lưu thành viên"
              : "Thêm thành viên"}
        </Button>
      </fieldset>
    </form>
  );
}
export function AccountFormView({
  state,
  controller,
  disabled,
  onViewMembers,
}: {
  state: AdminState;
  controller: AdminController;
  disabled: boolean;
  onViewMembers?: () => void;
}) {
  const account = state.account;
  const [expected, setExpected] = useState(state.list.version ?? 1);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { username: "", temporary_password: "", roles: ["viewer"] },
  });
  const roles = useWatch({ control, name: "roles" });
  const locked = account.key !== null,
    completed = account.status === "completed";
  const busy = disabled || isSubmitting || account.status === "sending";
  useEffect(() => {
    if (account.status === "completed")
      reset({ username: "", temporary_password: "", roles: ["viewer"] });
  }, [account.status, reset]);
  useEffect(
    () => () => {
      reset({ username: "", temporary_password: "", roles: ["viewer"] });
    },
    [reset],
  );
  return (
    <section className="ui-panel space-y-4">
      <h2 className="type-h2">Tạo tài khoản SSO</h2>
      <p>
        Mật khẩu tạm chỉ giữ trong bộ nhớ trang. Rời trang, tải lại, đổi workspace hoặc xác minh lại
        quyền có thể làm mất intent; khi đó kiểm tra theo quy trình vận hành, không tạo lại cùng tài
        khoản bằng mã mới.
      </p>
      <p>Người dùng mới đổi mật khẩu và hoàn thành profile trên Keycloak khi đăng nhập lần đầu.</p>
      <form
        aria-label="Tạo tài khoản SSO"
        onSubmit={handleSubmit((values) => controller.createAccount(values, expected))}
        className="space-y-4"
      >
        <fieldset disabled={busy || locked || completed} className="space-y-3">
          <label className="type-label block">
            Tên đăng nhập
            <Input
              {...register("username")}
              autoComplete="off"
              maxLength={64}
              aria-invalid={!!errors.username}
            />
          </label>
          {errors.username && <p role="alert">{errors.username.message}</p>}
          <label className="type-label block">
            Mật khẩu tạm
            <Input
              type="password"
              {...register("temporary_password")}
              autoComplete="new-password"
              maxLength={128}
              aria-invalid={!!errors.temporary_password}
            />
          </label>
          {errors.temporary_password && <p role="alert">{errors.temporary_password.message}</p>}
          <RoleOptions
            value={roles}
            onChange={(next) => setValue("roles", next, { shouldValidate: true })}
          />
          {errors.roles && <p role="alert">Chọn ít nhất một vai trò.</p>}
        </fieldset>
        {state.list.version !== null && !completed && (
          <VersionChoice
            selected={expected}
            current={state.list.version}
            disabled={busy}
            choose={() => setExpected(state.list.version ?? expected)}
          />
        )}
        {!locked && !completed && (
          <Button type="submit" disabled={busy || expected !== state.list.version}>
            Tạo tài khoản
          </Button>
        )}
        {locked && !completed && (
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void controller.checkOperation()}
            >
              Kiểm tra trạng thái
            </Button>
            {!account.rejection && (
              <Button type="submit" disabled={busy || expected !== state.list.version}>
                Thử hoàn tất lại cùng mã thao tác
              </Button>
            )}
          </div>
        )}
      </form>
      {account.status === "sending" && <p role="status">Đang xử lý tài khoản…</p>}
      {(account.status === "pending" || account.status === "uncertain") && (
        <p role="status">
          {account.status === "pending"
            ? "Thao tác đang ở trạng thái pending; chưa xác nhận tài khoản đã tạo thành công."
            : "Chưa rõ kết quả tạo tài khoản."}{" "}
          Không tạo thao tác mới cho cùng tài khoản.
        </p>
      )}
      {account.rejection && (
        <div role="status" className="space-y-2 rounded-md border border-warning/40 bg-control p-4">
          <p>{adminError(account.rejection)}</p>
          <p>
            Đã dừng gửi lại nội dung bị từ chối. Mã thao tác cũ vẫn được giữ để kiểm tra trạng thái;
            pending không xác nhận thao tác đã hủy hoặc có thể gửi lại an toàn.
          </p>
          <p>
            Backend chưa có cơ chế hủy hoặc thay thế intent này. Liên hệ vận hành để đối chiếu trước
            khi tạo intent khác; tải lại trang không hủy thao tác cũ. Bạn vẫn có thể quản lý thành
            viên độc lập ở tab Thành viên và quyền.
          </p>
        </div>
      )}
      <AdminFailure error={account.error === account.rejection ? null : account.error} />
      {completed && account.result && (
        <div role="status" className="space-y-3">
          <p>
            Đã tạo tài khoản {account.result.username}. Subject:{" "}
            <span className="break-all">{account.result.subject}</span>. Tài khoản chưa tự có quyền
            nguồn.
          </p>
          {onViewMembers && (
            <Button type="button" variant="secondary" disabled={busy} onClick={onViewMembers}>
              Tới Thành viên và quyền để cấp nguồn
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              controller.resetAccount();
              setExpected(state.list.version ?? expected);
            }}
          >
            Tạo tài khoản khác
          </Button>
        </div>
      )}
    </section>
  );
}
