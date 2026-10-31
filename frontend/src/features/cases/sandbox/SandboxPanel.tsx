import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { TechnicalDetails } from "../../../components/ui/TechnicalDetails";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../../components/ui/Table";
import type { ApiError } from "../../../services/apiError";
import type { CasesState } from "../state/state";
import type { CasesContextValue } from "../state/casesContext";
import { eventTimeLabel } from "../../events/presentation";
import { attemptSchema } from "./schemas";
import type { Sandbox, HistoricalAttempt, Command, Lab } from "./schemas";
import {
  latestMatchingProof,
  nextSandboxStep,
  observationLabel,
  proofNotice,
  reasonLabel,
  resultLabel,
} from "./presentation";

function Failure({ error }: { error: ApiError | null }) {
  return (
    error && (
      <div role="alert" className="space-y-2 text-danger">
        <p>{error.message}</p>
        <TechnicalDetails headingLevel={4} title="Mã tra cứu lỗi">
          <p>
            {error.code} · {error.requestId ?? "Không có mã tra cứu"}
          </p>
        </TechnicalDetails>
      </div>
    )
  );
}
export function AttemptView({ attempt }: { attempt: HistoricalAttempt }) {
  const parsed = attemptSchema.safeParse(attempt);
  if (!parsed.success)
    return (
      <div>
        <p>Lần chạy từ checker cũ; không dùng để kết luận nguồn hiện tại đạt.</p>
        <TechnicalDetails headingLevel={4} title="Snapshot checker cũ">
          <pre>{JSON.stringify(attempt, null, 2)}</pre>
        </TechnicalDetails>
      </div>
    );
  const item = parsed.data;
  return (
    <div className="space-y-2">
      <p className="font-semibold">
        Lần {item.number} — {resultLabel(item.result)}
      </p>
      <p>
        {eventTimeLabel(item.at)} (UTC+7) · RAM cần {item.required_ram} GB / khả dụng lúc chạy{" "}
        {item.available_ram} GB
      </p>
      <ul className="space-y-1">
        {item.checks.map((check) => (
          <li key={check.step}>
            {check.step === "ram" ? "RAM" : check.step === "image" ? "Image" : "Tài khoản mô phỏng"}
            : {check.passed ? "Đạt" : `Không đạt — ${reasonLabel(check.reason)}`}
          </li>
        ))}
      </ul>
      {item.blockers.length > 0 && (
        <ul>
          {item.blockers.map((reason, index) => (
            <li key={`${index}:${reason}`}>{reasonLabel(reason)}</li>
          ))}
        </ul>
      )}
      <TechnicalDetails headingLevel={4} title="Mã và snapshot lần chạy">
        <pre>{JSON.stringify(item, null, 2)}</pre>
      </TechnicalDetails>
    </div>
  );
}
function keyedAttempts(attempts: HistoricalAttempt[]) {
  const occurrences = new Map<string, number>();
  return attempts.map((attempt) => {
    const identity =
      typeof attempt.id === "string" && attempt.id
        ? `id:${attempt.id}`
        : `legacy:${JSON.stringify(attempt)}`;

    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { attempt, key: JSON.stringify([identity, occurrence]) };
  });
}
const resourceFormSchema = z
  .strictObject({
    action: z.enum(["capacity", "image", "account"]),
    ram: z.string(),
    available: z.boolean(),
    active: z.boolean(),
    image_id: z.string(),
    account_id: z.string(),
    expected_case_version: z.number().int().min(1),
    expected_version: z.number().int().min(1),
  })
  .superRefine((value, ctx) => {
    if (
      value.action === "capacity" &&
      (!/^\d+$/.test(value.ram) ||
        !Number.isSafeInteger(Number(value.ram)) ||
        Number(value.ram) > 1048576)
    )
      ctx.addIssue({ code: "custom", path: ["ram"], message: "Nhập số nguyên từ 0 đến 1048576." });
  });
type ResourceForm = z.infer<typeof resourceFormSchema>;
function ConditionsForm({
  snapshot,
  lab,
  disabled,
  submit,
}: {
  snapshot: Sandbox;
  lab: Lab | null;
  disabled: boolean;
  submit: (body: Command) => Promise<void>;
}) {
  const conditions = snapshot.observation.conditions;
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResourceForm>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      action: "capacity",
      ram: lab ? String(lab.ram) : "",
      available: conditions?.image_available ?? false,
      active: conditions?.account_active ?? false,
      image_id: conditions?.image_id ?? "",
      account_id: conditions?.account_id ?? "",
      expected_case_version: snapshot.case_version,
      expected_version: snapshot.observation.source_version ?? 1,
    },
  });
  const values = useWatch({ control });
  const stale =
    values.expected_case_version !== snapshot.case_version ||
    values.expected_version !== snapshot.observation.source_version ||
    values.image_id !== conditions?.image_id ||
    values.account_id !== conditions?.account_id;
  function adopt() {
    setValue("expected_case_version", snapshot.case_version);
    setValue("expected_version", snapshot.observation.source_version ?? 1);
    setValue("image_id", conditions?.image_id ?? "");
    setValue("account_id", conditions?.account_id ?? "");
  }
  return (
    <form
      noValidate
      aria-label="Sửa điều kiện mô phỏng"
      className="space-y-3"
      onSubmit={handleSubmit((values) => {
        const versions = {
          expected_case_version: values.expected_case_version,
          expected_version: values.expected_version,
        };
        if (values.action === "capacity")
          return submit({ action: "capacity", ram: Number(values.ram), ...versions });
        if (values.action === "image")
          return submit({
            action: "image",
            image_id: values.image_id,
            available: values.available,
            ...versions,
          });
        return submit({
          action: "account",
          account_id: values.account_id,
          active: values.active,
          ...versions,
        });
      })}
    >
      <h3 className="type-h3">Sửa điều kiện nguồn</h3>
      <fieldset disabled={disabled || isSubmitting} className="min-w-0 space-y-3">
        <label className="block">
          Điều kiện cần sửa
          <Select {...register("action")}>
            <option value="capacity">Tổng RAM</option>
            <option value="image">Image</option>
            <option value="account">Tài khoản mô phỏng</option>
          </Select>
        </label>
        <div hidden={values.action !== "capacity"}>
          <label className="block">
            Tổng RAM sandbox (GB)
            <Input
              type="number"
              min={0}
              max={1048576}
              {...register("ram")}
              aria-invalid={!!errors.ram}
              aria-describedby={errors.ram ? "sandbox-ram-error" : undefined}
            />
          </label>
          <p className="text-sm text-muted">
            Đặt tổng RAM, không phải lượng cộng thêm. BE kiểm tra RAM đang giữ chỗ.
          </p>
          {lab && (
            <Button type="button" variant="ghost" onClick={() => setValue("ram", String(lab.ram))}>
              Điền tổng RAM hiện tại ({lab.ram} GB)
            </Button>
          )}
          {!lab && (
            <p role="status">
              Chưa đọc được tổng RAM cùng phiên bản nguồn. Làm mới trước khi sửa capacity.
            </p>
          )}
        </div>
        {errors.ram && (
          <p id="sandbox-ram-error" role="alert">
            Nhập số nguyên từ 0 đến 1048576.
          </p>
        )}
        <label hidden={values.action !== "image"} className="min-h-10 items-center gap-2">
          <input type="checkbox" {...register("available")} /> Image mô phỏng khả dụng
        </label>
        <label hidden={values.action !== "account"} className="min-h-10 items-center gap-2">
          <input type="checkbox" {...register("active")} /> Tài khoản nghiệp vụ mô phỏng hoạt động
        </label>
        {stale && (
          <div role="status">
            <p>
              Dữ liệu nguồn đã thay đổi. Đối chiếu điều kiện hiện tại trước khi chọn phiên bản mới;
              nội dung nháp được giữ.
            </p>
            <Button type="button" variant="secondary" onClick={adopt}>
              Dùng phiên bản và tài nguyên mới
            </Button>
          </div>
        )}
        <Button
          type="submit"
          disabled={stale || !conditions || (values.action === "capacity" && !lab)}
        >
          Lưu điều kiện mô phỏng
        </Button>
      </fieldset>
    </form>
  );
}
type Actions = Pick<
  CasesContextValue,
  | "loadSandbox"
  | "submitSandboxCommand"
  | "retrySandboxProvision"
  | "saveSandboxProof"
  | "beginSandboxIntent"
>;
export function SandboxPanel({ state, actions }: { state: CasesState; actions: Actions }) {
  const [open, setOpen] = useState(true);
  const detail = state.detail.data;
  const version = detail?.case.version;
  const ready = state.detail.status === "ready" && state.status === "active";
  const { loadSandbox } = actions;
  useEffect(() => {
    if (ready) void loadSandbox();
  }, [ready, version, loadSandbox]);
  const sandbox = state.sandbox,
    mutation = sandbox.mutation,
    snapshot = sandbox.snapshot.data,
    observation = snapshot?.observation;
  const closed = detail?.case.state === "closed";
  const busy =
    !ready ||
    mutation.status === "sending" ||
    sandbox.snapshot.status === "loading" ||
    sandbox.proofs.status === "loading" ||
    sandbox.lab.status === "loading" ||
    ["validating", "sending"].includes(state.workflow.status) ||
    state.evidenceMutation.status === "sending" ||
    state.linkMutation.status === "sending" ||
    state.snapshot.status === "loading" ||
    state.caseRun.status === "loading";
  const frozen =
    busy ||
    closed ||
    mutation.status !== "idle" ||
    state.workflow.status === "uncertain" ||
    state.evidenceMutation.status === "uncertain" ||
    state.linkMutation.status === "uncertain";
  const caseAligned = sandbox.snapshot.status === "ready" && snapshot?.case_version === version;
  const current =
    caseAligned &&
    observation?.source === "lab-sandbox" &&
    observation.simulated === true &&
    observation.source_version !== undefined;
  const proofsReady =
    ready &&
    caseAligned &&
    sandbox.proofs.status === "ready" &&
    sandbox.proofs.data?.case_version === version &&
    sandbox.proofs.data?.case_id === detail?.case.id;
  const matchingProof = proofsReady
    ? latestMatchingProof(sandbox.proofs.data?.items ?? [], snapshot, version ?? 0)
    : null;
  const progress = {
    caseState: detail?.case.state,
    proofStatus: !proofsReady
      ? ("unknown" as const)
      : matchingProof
        ? ("matched" as const)
        : ("missing" as const),
  };
  const intent = mutation.intent;
  const matched =
    intent?.action === "provision" &&
    observation?.attempts?.find((item) => {
      const parsed = attemptSchema.safeParse(item);
      return parsed.success && parsed.data.operation_id === intent.operation_id;
    });
  const unconfigured =
    ready &&
    !snapshot &&
    sandbox.snapshot.status === "error" &&
    sandbox.snapshot.error?.code === "SANDBOX_BINDING_REQUIRED" &&
    sandbox.lab.status === "error" &&
    sandbox.lab.error?.status === 404 &&
    sandbox.proofs.status === "ready";
  if (unconfigured)
    return (
      <section aria-label="Kiểm chứng nghiệp vụ mô phỏng" className="content-panel space-y-3">
        <h2 className="type-h2">Kiểm chứng nghiệp vụ mô phỏng</h2>
        <p>Hồ sơ này chưa gắn với nguồn mô phỏng; workspace hiện tại chưa có cấu hình sandbox.</p>
        <p>
          Tiếp tục xử lý tại lịch sử, bằng chứng và tác vụ hồ sơ. BE vẫn kiểm tra điều kiện đóng
          theo chính sách hiện tại.
        </p>
        <Button type="button" variant="tertiary" onClick={() => void actions.loadSandbox()}>
          Kiểm tra lại nguồn
        </Button>
      </section>
    );
  return (
    <section aria-label="Kiểm chứng nghiệp vụ mô phỏng" className="content-panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-h2">Kiểm chứng nghiệp vụ mô phỏng</h2>
        <Button
          variant="tertiary"
          type="button"
          aria-expanded={open}
          aria-controls="sandbox-content"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Thu gọn kiểm chứng" : "Mở kiểm chứng"}
        </Button>
      </div>
      <p>
        Đây là mô phỏng; không thao tác VM, registry hoặc mạng thật. Tài khoản nghiệp vụ mô phỏng
        khác tài khoản đăng nhập SSO.
      </p>
      {closed ? (
        <p className="font-semibold">Hồ sơ đã đóng — xem kết quả và bằng chứng đã lưu bên dưới.</p>
      ) : (
        observation && (
          <p className="font-semibold">
            {observationLabel(observation, progress)}
            {sandbox.snapshot.status !== "ready" && " — dữ liệu cần tải lại"}
          </p>
        )
      )}
      {observation && (
        <p>
          {sandbox.snapshot.status === "ready"
            ? nextSandboxStep(observation, closed, progress)
            : "Cần đọc lại nguồn trước khi xác định bước tiếp theo."}
        </p>
      )}
      <div id="sandbox-content" hidden={!open} className="space-y-5">
        <Button
          variant="tertiary"
          type="button"
          disabled={busy}
          onClick={() => void actions.loadSandbox()}
        >
          Kiểm tra chuyển log và làm mới nguồn
        </Button>
        {[sandbox.snapshot, sandbox.proofs, sandbox.lab].some(
          (item) => item.status === "loading",
        ) && <p role="status">Đang đọc nguồn mô phỏng, lịch sử kiểm chứng và tổng RAM…</p>}
        <Failure error={sandbox.snapshot.error} />
        <Failure error={sandbox.proofs.error} />
        <Failure error={sandbox.lab.error} />
        {sandbox.snapshot.error && (
          <p>
            Module chưa đọc được trạng thái. Không suy ra hồ sơ được miễn proof; phần điều tra và
            guard đóng hồ sơ vẫn giữ nguyên.
          </p>
        )}
        {observation && (
          <div className="space-y-3">
            <h3 className="type-h3">Điều kiện hiện tại</h3>
            <p>
              Mã yêu cầu nguồn:{" "}
              <span className="break-all">{observation.request_id ?? "Chưa xác định"}</span>
            </p>
            {closed ? (
              <p>
                Nguồn hiện tại:{" "}
                {observation.reason === "RERUN_REQUIRED"
                  ? "Khác phiên bản lần chạy đã lưu. Đây không phải kết quả chạy thất bại và không thay đổi lịch sử hồ sơ đã đóng."
                  : observation.reason === "NOT_EXECUTED"
                    ? "Chưa có lần thực thi."
                    : resultLabel(observation.result)}{" "}
                Kết quả tại thời điểm chạy nằm ở mục “Lần chạy gần nhất”.
              </p>
            ) : (
              <p>{reasonLabel(observation.reason)}</p>
            )}
            {sandbox.lab.status === "ready" && sandbox.lab.data && (
              <p>Tổng RAM hiện tại của sandbox: {sandbox.lab.data.ram} GB</p>
            )}
            {observation.conditions ? (
              <dl className="grid gap-2 sm:grid-cols-3">
                <div>
                  <dt>RAM yêu cầu</dt>
                  <dd>{observation.conditions.required_ram} GB</dd>
                </div>
                <div>
                  <dt>Image</dt>
                  <dd>{observation.conditions.image_available ? "Khả dụng" : "Chưa khả dụng"}</dd>
                </div>
                <div>
                  <dt>Tài khoản mô phỏng</dt>
                  <dd>{observation.conditions.account_active ? "Hoạt động" : "Chưa kích hoạt"}</dd>
                </div>
              </dl>
            ) : (
              <p>Quan sát này chưa cung cấp đủ điều kiện.</p>
            )}
            <p>
              Chuyển log:{" "}
              {observation.delivery
                ? observation.delivery.status === "delivered"
                  ? `Đã chuyển ${observation.delivery.delivered}/${observation.delivery.total}`
                  : `Đang chờ ${observation.delivery.delivered}/${observation.delivery.total}`
                : "Chưa có bằng chứng chuyển log"}
              . Trạng thái này không thay proof reviewer.
            </p>
          </div>
        )}
        {snapshot && state.scope?.canAdmin && (
          <ConditionsForm
            snapshot={snapshot}
            lab={
              sandbox.lab.status === "ready" &&
              sandbox.lab.data?.version === observation?.source_version
                ? sandbox.lab.data
                : null
            }
            disabled={frozen || !current}
            submit={actions.submitSandboxCommand}
          />
        )}
        {state.scope?.canWrite && snapshot && (
          <div className="space-y-2">
            <h3 className="type-h3">Thực thi lại nghiệp vụ</h3>
            <p>Lưu điều kiện chỉ đổi nguồn; chạy lại là một ý định thực thi riêng.</p>
            <Button
              type="button"
              disabled={frozen || !current}
              onClick={() => {
                const sourceVersion = snapshot.observation.source_version;
                if (sourceVersion !== undefined)
                  void actions.submitSandboxCommand({
                    action: "provision",
                    expected_case_version: snapshot.case_version,
                    expected_version: sourceVersion,
                    operation_id: crypto.randomUUID(),
                  });
              }}
            >
              Chạy lại mô phỏng
            </Button>
          </div>
        )}
        <Failure error={mutation.error} />
        {mutation.status === "sending" && <p role="status">Đang gửi thao tác; không gửi lại.</p>}
        {mutation.status === "success" && (
          <p role="status">
            {mutation.kind === "proof"
              ? `Đã lưu kiểm chứng: ${mutation.savedProof ? resultLabel(mutation.savedProof.observation.result) : "chờ đối chiếu"}. HTTP 201 không đồng nghĩa đạt hoặc đã đóng hồ sơ.`
              : "BE đã nhận lệnh. Đọc kết quả nguồn hiện tại; lưu điều kiện không đồng nghĩa thực thi đạt."}
          </p>
        )}
        {mutation.status === "uncertain" && (
          <p role="status">
            Chưa rõ kết quả ghi. Đã yêu cầu GET đối chiếu; không tự gửi lại. Abort hoặc timeout
            không chứng minh server chưa thực hiện.
          </p>
        )}
        {intent?.action === "provision" && (
          <TechnicalDetails headingLevel={3} title="Ý định thực thi đang giữ">
            <pre>{JSON.stringify(intent, null, 2)}</pre>
          </TechnicalDetails>
        )}
        {matched && (
          <div role="status">
            <p>
              Đã tìm thấy attempt cùng operation ID trong lịch sử; không tạo execution mới để thay
              thế.
            </p>
            <AttemptView attempt={matched} />
          </div>
        )}
        {intent?.action === "provision" && ["uncertain", "conflict"].includes(mutation.status) && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || closed || !current || !mutation.reconciled}
            onClick={() => void actions.retrySandboxProvision()}
          >
            Đã đối chiếu — gửi lại đúng thao tác cũ
          </Button>
        )}
        {mutation.status !== "idle" && mutation.status !== "sending" && (
          <Button
            type="button"
            variant="tertiary"
            disabled={
              busy ||
              (["uncertain", "conflict"].includes(mutation.status) &&
                (!mutation.reconciled ||
                  (mutation.status === "uncertain" && intent?.action === "provision" && !matched)))
            }
            onClick={actions.beginSandboxIntent}
          >
            Đã đọc kết quả và lịch sử — kết thúc đối chiếu
          </Button>
        )}
        {mutation.execution && (
          <div className="space-y-2">
            <h3 className="type-h3">Kết quả operation vừa gửi</h3>
            <p>
              {mutation.execution.replayed
                ? "Replay thao tác cũ; không tạo attempt mới."
                : "Kết quả của ý định vừa gửi."}{" "}
              Quan sát nguồn hiện tại có thể khác kết quả này.
            </p>
            <AttemptView attempt={mutation.execution.attempt} />
          </div>
        )}
        {observation?.attempt && (
          <div>
            <h3 className="type-h3">Lần chạy gần nhất</h3>
            <AttemptView attempt={observation.attempt} />
          </div>
        )}
        <div className="space-y-3">
          <h3 className="type-h3">Lịch sử thực thi bất biến</h3>
          {observation?.attempts?.length ? (
            <ol className="space-y-4">
              {keyedAttempts(observation.attempts).map(({ attempt, key }) => (
                <li key={key} className="border-t border-line pt-3">
                  <AttemptView attempt={attempt} />
                </li>
              ))}
            </ol>
          ) : (
            <p>Chưa có lịch sử thực thi trong dữ liệu đã đọc.</p>
          )}
        </div>
        <div className="space-y-3">
          <h3 className="type-h3">Kiểm chứng nguồn của reviewer</h3>
          {state.scope?.canVerify && (
            <>
              <p>
                Chỉ lưu khi hồ sơ chờ xác minh. Mỗi lần lưu tạo snapshot riêng; không tự đóng hồ sơ.
              </p>
              <Button
                type="button"
                disabled={
                  frozen ||
                  !caseAligned ||
                  sandbox.proofs.status !== "ready" ||
                  detail?.case.state !== "awaiting_verification"
                }
                onClick={() => void actions.saveSandboxProof()}
              >
                Lưu kiểm chứng nguồn
              </Button>
            </>
          )}
          {sandbox.proofs.data?.items.length ? (
            <Table caption="Lịch sử kiểm chứng nguồn">
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian (UTC+7)</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>Đối chiếu hiện tại</TableHead>
                  <TableHead>Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sandbox.proofs.data.items.map((proof) => (
                  <TableRow key={proof.id}>
                    <TableCell>{eventTimeLabel(proof.checked_at)}</TableCell>
                    <TableCell>
                      {resultLabel(proof.observation.result)}
                      <p>{reasonLabel(proof.observation.reason)}</p>
                    </TableCell>
                    <TableCell>
                      {proofNotice(
                        proof,
                        sandbox.snapshot.status === "ready" ? snapshot : null,
                        version ?? 0,
                        closed,
                      )}
                    </TableCell>
                    <TableCell>
                      <TechnicalDetails headingLevel={4} title="Snapshot kiểm chứng">
                        <pre>{JSON.stringify(proof, null, 2)}</pre>
                      </TechnicalDetails>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p>Chưa có bản kiểm chứng trong lịch sử đã đọc.</p>
          )}
        </div>
        {snapshot && (
          <TechnicalDetails headingLevel={3} title="Binding, phiên bản và môi trường mô phỏng">
            <pre>{JSON.stringify(snapshot, null, 2)}</pre>
          </TechnicalDetails>
        )}
      </div>
    </section>
  );
}
