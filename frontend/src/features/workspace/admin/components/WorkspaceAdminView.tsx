import { useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../../components/ui/Table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../../../components/ui/primitives/tabs";
import { Loader } from "../../../../components/ui/Loader";
import { roleLabel } from "../../presentation";
import type { Source } from "../../../../types/workspace";
import type { Member } from "../schemas";
import type { AdminState, AdminController } from "../controller";
import { MemberForm, AccountFormView, VersionChoice, AdminFailure } from "./AdminForms";
import type { MemberDraft } from "./AdminForms";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../../../../components/ui/primitives/sheet";

function SubjectValue({ subject }: { subject: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(subject);
      setMessage("Đã sao chép subject.");
    } catch {
      setMessage("Chưa sao chép được. Mở chi tiết để chọn subject đầy đủ.");
    }
  }
  return (
    <div className="space-y-1">
      <span title={subject} className="break-all">
        {subject.length > 24 ? `${subject.slice(0, 12)}…${subject.slice(-8)}` : subject}
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={() => void copy()}
        aria-label={`Sao chép subject ${subject}`}
      >
        Sao chép
      </Button>
      {message && <p role="status">{message}</p>}
      <details>
        <summary>Subject đầy đủ</summary>
        <span className="break-all select-all">{subject}</span>
      </details>
    </div>
  );
}
function SourceGrants({
  member,
  sources,
  version,
  controller,
  disabled,
}: {
  member: Member;
  sources: Source[];
  version: number;
  controller: AdminController;
  disabled: boolean;
}) {
  const [expected, setExpected] = useState(version);
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <section className="space-y-4 border-t border-line pt-5">
      <h3 className="type-h3">Quyền đọc nguồn trực tiếp</h3>
      <p>
        Chỉ cấp hoặc thu hồi nguồn bạn hiện đọc được. Thu hồi direct read không loại bỏ quyền qua
        nhóm.
      </p>
      <VersionChoice
        selected={expected}
        current={version}
        disabled={disabled}
        choose={() => {
          setExpected(version);
          setConfirm(null);
        }}
      />
      {sources.length === 0 && <p>Không có nguồn trong phạm vi đọc hiện tại.</p>}
      {sources.map((source) => {
        const enabled = member.direct_source_ids.includes(source.id);
        return (
          <div
            key={source.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2"
          >
            <span className="min-w-0 break-words">
              {source.name} · {enabled ? "Có direct read" : "Chưa có direct read"}
            </span>
            <Button
              type="button"
              variant={enabled ? "danger" : "secondary"}
              disabled={disabled || !member.active || expected !== version}
              onClick={() => {
                if (enabled && confirm !== source.id) {
                  setConfirm(source.id);
                  return;
                }
                setConfirm(null);
                void controller.mutate({
                  kind: "grant",
                  subject: member.subject,
                  sid: source.id,
                  body: { enabled: !enabled, expected_version: expected },
                });
              }}
            >
              {enabled
                ? confirm === source.id
                  ? "Xác nhận thu hồi direct read"
                  : "Thu hồi direct read"
                : "Cấp direct read"}
            </Button>
            {confirm === source.id && (
              <p role="alert" className="w-full">
                Thu hồi quyền đọc trực tiếp nguồn {source.name} của thành viên đang chọn? Quyền qua
                nhóm vẫn giữ nguyên.{" "}
                <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
                  Hủy
                </Button>
              </p>
            )}
          </div>
        );
      })}
      {!member.active && <p role="status">Kích hoạt membership trước khi thay đổi quyền nguồn.</p>}
    </section>
  );
}
export function WorkspaceAdminView({
  state,
  controller,
  sources,
  sourcesReady,
  tab,
  changeTab,
}: {
  state: AdminState;
  controller: AdminController;
  sources: Source[];
  sourcesReady: boolean;
  tab: string;
  changeTab: (tab: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState("add");
  const [addDraft, setAddDraft] = useState<MemberDraft>();
  const [editDraft, setEditDraft] = useState<MemberDraft>();
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const membersTab = useRef<HTMLButtonElement | null>(null);
  const member = state.list.items.find((item) => item.subject === selected);
  const busy =
    state.blocked ||
    state.list.status !== "ready" ||
    state.mutation.status === "sending" ||
    state.account.status === "sending";
  const editDisabled = busy;
  return (
    <div className="space-y-5">
      <AdminFailure error={state.list.error} />
      {!state.blocked && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="tertiary"
            disabled={
              state.list.status === "loading" ||
              state.mutation.status === "sending" ||
              state.account.status === "sending"
            }
            onClick={() => void controller.refresh()}
          >
            Làm mới thành viên
          </Button>
          {tab === "members" && (
            <Button
              type="button"
              disabled={editDisabled}
              onClick={(event) => {
                returnFocus.current = event.currentTarget;
                setPanelMode("add");
                setPanelOpen(true);
              }}
            >
              Thêm thành viên
            </Button>
          )}
        </div>
      )}
      {state.list.status === "loading" && (
        <Loader message="Đang tải thành viên và phiên bản quản trị…" />
      )}
      {state.blocked ? (
        <p role="status">
          Đã xóa dữ liệu quản trị. Xác minh lại phiên hoặc quyền workspace để tiếp tục.
        </p>
      ) : (
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList
            aria-label="Quản trị workspace"
            className="grid h-auto w-full grid-cols-1 sm:grid-cols-2"
          >
            <TabsTrigger ref={membersTab} value="members">
              Thành viên và quyền
            </TabsTrigger>
            <TabsTrigger value="accounts">Tạo tài khoản</TabsTrigger>
          </TabsList>
          <TabsContent value="members" forceMount className="space-y-5">
            <AdminFailure error={state.mutation.error} />
            {state.mutation.status === "success" && (
              <p role="status">Đã lưu thay đổi. Xem trạng thái tải danh sách mới bên trên.</p>
            )}
            {state.mutation.status === "uncertain" && (
              <p role="status">
                Chưa rõ kết quả ghi. Đối chiếu danh sách mới trước khi chủ động thao tác tiếp; hệ
                thống không tự gửi lại.
              </p>
            )}
            {state.account.status === "completed" && state.account.result && (
              <div className="space-y-2 rounded-md border border-line p-4">
                <p>
                  Tài khoản vừa tạo chưa tự có quyền nguồn. Tìm subject dưới đây trong bảng, chọn
                  Sửa thành viên rồi cấp quyền đọc nguồn trực tiếp.
                </p>
                <SubjectValue subject={state.account.result.subject} />
                {!state.list.items.some(
                  (item) => item.subject === state.account.result?.subject,
                ) && (
                  <p>
                    Tài khoản chưa có trong các dòng đang tải. Dùng Tải thêm thành viên nếu còn
                    trang; nếu không có, làm mới danh sách để đối chiếu.
                  </p>
                )}
              </div>
            )}
            <Table caption="Thành viên workspace">
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Quyền nguồn trực tiếp</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.list.items.map((item) => (
                  <TableRow key={item.subject}>
                    <TableCell>
                      <SubjectValue subject={item.subject} />
                    </TableCell>
                    <TableCell>{item.active ? "Hoạt động" : "Đã thu hồi"}</TableCell>
                    <TableCell>
                      {item.roles.map(roleLabel).join(" · ") || "Chưa có vai trò"}
                    </TableCell>
                    <TableCell>
                      {item.direct_source_ids.length === 0
                        ? "Chưa có"
                        : item.direct_source_ids.map((id) => (
                            <p key={id}>
                              {sources.find((source) => source.id === id)?.name ??
                                "Nguồn không khả dụng"}
                            </p>
                          ))}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="tertiary"
                        disabled={editDisabled || item.roles.includes("ingest_service")}
                        onClick={(event) => {
                          returnFocus.current = event.currentTarget;
                          if (selected !== item.subject) setEditDraft(undefined);
                          setSelected(item.subject);
                          setPanelMode("edit");
                          setPanelOpen(true);
                        }}
                      >
                        Sửa thành viên
                      </Button>
                      {item.roles.includes("ingest_service") && (
                        <p>Tài khoản dịch vụ được bảo vệ</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {state.list.status === "ready" && state.list.items.length === 0 && (
              <p>Chưa có thành viên trong danh sách.</p>
            )}
            {state.list.next && (
              <Button
                type="button"
                variant="tertiary"
                disabled={busy}
                onClick={() => void controller.more()}
              >
                Tải thêm thành viên
              </Button>
            )}
          </TabsContent>
          <TabsContent value="accounts" forceMount className="mx-auto w-full max-w-2xl">
            <AccountFormView
              state={state}
              controller={controller}
              disabled={busy}
              onViewMembers={() => {
                changeTab("members");
                membersTab.current?.focus();
                void controller.refresh();
              }}
            />
          </TabsContent>
        </Tabs>
      )}
      {!state.blocked && (
        <Sheet open={panelOpen && tab === "members"} onOpenChange={setPanelOpen}>
          <SheetContent
            side="right"
            className="w-full gap-0 bg-panel p-0 sm:max-w-lg"
            onCloseAutoFocus={(event) => {
              if (returnFocus.current?.isConnected) {
                event.preventDefault();
                returnFocus.current.focus();
              }
            }}
          >
            <SheetHeader className="shrink-0 border-b border-line p-5 pr-12">
              <SheetTitle>
                {panelMode === "add" ? "Thêm người đã có SSO" : "Sửa thành viên"}
              </SheetTitle>
              <SheetDescription>
                {panelMode === "add"
                  ? "Thêm membership bằng subject Keycloak và chọn vai trò."
                  : "Thay đổi vai trò, trạng thái membership và quyền nguồn trực tiếp."}{" "}
                Bản nháp được giữ khi đóng panel trong trang này.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
              <AdminFailure error={state.mutation.error} />
              {state.mutation.status === "success" && (
                <p role="status">Đã lưu thay đổi. Đọc dữ liệu mới trước khi thao tác tiếp.</p>
              )}
              {state.list.version !== null &&
                (panelMode === "add" ? (
                  <MemberForm
                    key="add"
                    version={state.list.version}
                    disabled={editDisabled}
                    controller={controller}
                    draft={addDraft}
                    onDraft={setAddDraft}
                    hideTitle
                  />
                ) : member ? (
                  <>
                    <MemberForm
                      key={member.subject}
                      member={member}
                      version={state.list.version}
                      disabled={editDisabled}
                      controller={controller}
                      draft={editDraft}
                      onDraft={setEditDraft}
                      hideTitle
                    />
                    <SourceGrants
                      key={`sources:${member.subject}`}
                      member={member}
                      sources={sources}
                      version={state.list.version}
                      controller={controller}
                      disabled={editDisabled || !sourcesReady}
                    />
                  </>
                ) : (
                  <p role="status">
                    Thành viên không nằm trong trang dữ liệu mới. Đóng panel và chọn lại từ danh
                    sách.
                  </p>
                ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
