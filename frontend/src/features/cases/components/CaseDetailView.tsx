import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CaseEvidenceSnapshot } from "../state/state";
import type { Source } from "../../workspace/schemas";
import { EvidenceEvents } from "./EvidenceEvents";
import type { CaseDetail } from "../schemas";
import { caseStateLabel, caseActionLabel, nextCaseStep } from "../presentation";
import { eventTimeLabel } from "../../events/presentation";
import { Button } from "../../../components/ui/Button";
import { TechnicalDetails } from "../../../components/ui/TechnicalDetails";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/primitives/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../../../components/ui/primitives/accordion";

export function CaseTime({ value }: { value: string }) {
  return (
    <time dateTime={value} title={`UTC gốc: ${value}`}>
      {eventTimeLabel(value)} (UTC+7)
    </time>
  );
}
export function CaseOverview({ item }: { item: CaseDetail["case"] }) {
  return (
    <section aria-label="Thông tin case" className="case-overview space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="type-h2 min-w-0 break-words">{item.title}</h2>
        <p className="type-label text-primary">{caseStateLabel(item.state)}</p>
      </div>
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-2">
        <p>
          Người xử lý: <span className="break-all">{item.owner_id ?? "Chưa được gán"}</span>
        </p>
        <p className="type-body-sm text-muted">
          Cập nhật: <CaseTime value={item.updated_at} />
        </p>
      </div>
      <div className="rounded-md bg-control p-3">
        <strong>Việc tiếp theo:</strong> {nextCaseStep(item.state)}
      </div>
      <TechnicalDetails title="ID, phiên bản và thông tin kỹ thuật">
        <p>
          Case: {item.id}; Workspace: {item.workspace_id}; Run: {item.run_id}
        </p>
        <p>
          Workflow: {item.workflow_instance_id}; Creator: {item.creator_subject}
        </p>
        <p>Case.version: {item.version}</p>
        <p>
          UTC gốc — tạo: {item.created_at}; cập nhật: {item.updated_at}
        </p>
        <p>
          Ngày tạo: <CaseTime value={item.created_at} />
        </p>
      </TechnicalDetails>
    </section>
  );
}
export function CaseDetailView({
  detail,
  selectedTab,
  onTabChange,
  runPanel,
  snapshot,
  loadSnapshot,
  sources = [],
  showOverview = true,
}: {
  detail: CaseDetail;
  selectedTab?: string;
  onTabChange?: (tab: string) => void;
  runPanel?: ReactNode;
  snapshot?: CaseEvidenceSnapshot;
  loadSnapshot?: () => Promise<void>;
  sources?: Source[];
  showOverview?: boolean;
}) {
  const item = detail.case;
  const [localTab, setLocalTab] = useState("history");
  const tab = selectedTab ?? localTab;
  function setTab(value: string) {
    setLocalTab(value);
    onTabChange?.(value);
  }
  const snapshotStatus = snapshot?.status;
  const needsEvents = detail.evidence.some((item) => item.event_ids.length > 0);
  useEffect(() => {
    if (tab === "evidence" && needsEvents && snapshotStatus === "idle" && loadSnapshot)
      void loadSnapshot();
  }, [tab, needsEvents, snapshotStatus, loadSnapshot]);
  const [opened, setOpened] = useState<string[]>([]);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== "evidence" || !pendingFocus.current) return;
    const trigger = document.getElementById(`evidence-${pendingFocus.current}`);
    trigger?.scrollIntoView({ block: "nearest" });
    trigger?.focus();
    pendingFocus.current = null;
  }, [tab, opened]);
  function openEvidence(id: string) {
    pendingFocus.current = id;
    setOpened((previous) => (previous.includes(id) ? [...previous] : [...previous, id]));
    setTab("evidence");
  }
  return (
    <div className="case-content break-words">
      {showOverview && <CaseOverview item={item} />}
      <Tabs value={tab} onValueChange={setTab} className="content-panel">
        <TabsList
          aria-label="Thông tin hồ sơ"
          className="grid w-full grid-cols-1 gap-1 group-data-[orientation=horizontal]/tabs:h-auto sm:grid-cols-3"
        >
          <TabsTrigger className="h-auto whitespace-normal" value="history">
            Lịch sử
          </TabsTrigger>
          <TabsTrigger className="h-auto whitespace-normal" value="evidence">
            Bằng chứng ({detail.evidence.length})
          </TabsTrigger>
          {runPanel && (
            <TabsTrigger className="h-auto whitespace-normal" value="reconstruction">
              Kết quả tái dựng
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="history" forceMount>
          <section aria-label="Lịch sử workflow" className="pt-4">
            <h3 className="type-h3 mb-5">Lịch sử xử lý</h3>
            {detail.history.length === 0 ? (
              <p>Chưa có lịch sử xử lý.</p>
            ) : (
              <ol className="space-y-6">
                {detail.history.map((entry, index) => (
                  <li
                    className="space-y-2 border-l-2 border-primary pl-4"
                    key={`${entry.version}:${entry.occurred_at}:${index}`}
                  >
                    <p className="font-semibold">
                      {caseActionLabel(entry.action)}:{" "}
                      {entry.from_state ? caseStateLabel(entry.from_state) : "Khởi tạo"} →{" "}
                      {caseStateLabel(entry.to_state)}
                    </p>
                    <p className="type-body-sm text-muted">
                      Người thực hiện: {entry.actor_subject} ·{" "}
                      <CaseTime value={entry.occurred_at} />
                    </p>
                    <p className="whitespace-pre-wrap">Lý do: {entry.reason}</p>
                    <div className="flex flex-wrap gap-2">
                      {entry.evidence_refs.map((id, position) => (
                        <Button
                          key={id}
                          variant="ghost"
                          className="font-normal hover:bg-transparent hover:font-bold hover:text-primary dark:hover:bg-transparent"
                          disabled={!detail.evidence.some((item) => item.id === id)}
                          onClick={() => openEvidence(id)}
                        >
                          Mở bằng chứng {position + 1}
                        </Button>
                      ))}
                    </div>
                    <TechnicalDetails headingLevel={4} title="Phiên bản và tham chiếu bằng chứng">
                      <p>
                        UTC gốc: {entry.occurred_at} · version {entry.version} · Evidence refs (ID
                        evidence): {entry.evidence_refs.join(", ") || "Không có"}
                      </p>
                    </TechnicalDetails>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </TabsContent>
        <TabsContent value="evidence" forceMount>
          <section aria-label="Evidence của case" className="space-y-4 pt-4">
            <h3 className="type-h3">Bằng chứng đã lưu</h3>
            {snapshot?.error && <p role="alert">{snapshot.error.message}</p>}
            {needsEvents && loadSnapshot && (
              <Button
                variant="secondary"
                disabled={snapshotStatus === "loading"}
                onClick={() => {
                  void loadSnapshot();
                }}
              >
                Xem log trong ảnh chụp dữ liệu
              </Button>
            )}
            {detail.evidence.length === 0 ? (
              <p>Chưa có bằng chứng.</p>
            ) : (
              <Accordion type="multiple" value={opened} onValueChange={setOpened}>
                {detail.evidence.map((entry, index) => (
                  <AccordionItem key={entry.id} value={entry.id}>
                    <AccordionTrigger
                      headingLevel={4}
                      className="hover:bg-transparent hover:font-bold hover:text-primary"
                      id={`evidence-${entry.id}`}
                    >
                      Bằng chứng {index + 1} ·{" "}
                      {entry.kind === "note"
                        ? "Ghi chú xử lý"
                        : `${entry.event_ids.length} sự kiện trong ảnh chụp dữ liệu`}{" "}
                      · {eventTimeLabel(entry.created_at)}
                    </AccordionTrigger>
                    <AccordionContent forceMount className="space-y-3">
                      <p className="whitespace-pre-wrap break-words">
                        {entry.note || "Không có ghi chú kèm theo."}
                      </p>
                      <p>Người thêm: {entry.creator_subject}</p>
                      {entry.event_ids.length > 0 && snapshot && (
                        <EvidenceEvents
                          ids={entry.event_ids}
                          snapshot={snapshot}
                          sources={sources}
                        />
                      )}
                      <TechnicalDetails headingLevel={5} title="Tham chiếu sự kiện và dữ liệu gốc">
                        <p>
                          Evidence: {entry.id}; Case: {entry.case_id}; Kind: {entry.kind}
                        </p>
                        <p>
                          Event IDs: {entry.event_ids.join(", ") || "Không có event tham chiếu"}
                        </p>
                        <CaseTime value={entry.created_at} />
                        <p>UTC gốc: {entry.created_at}</p>
                      </TechnicalDetails>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
            <p className="type-caption text-muted">
              Bằng chứng đã lưu được giữ trong lịch sử. Thêm hoặc đọc bằng chứng không tự thay đổi
              phiên bản trạng thái hồ sơ.
            </p>
          </section>
        </TabsContent>
        {runPanel && (
          <TabsContent value="reconstruction" forceMount>
            {runPanel}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
