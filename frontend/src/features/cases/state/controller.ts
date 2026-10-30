import axios from "axios";
import { transitionSchema, transitionIssue } from '../workflow.ts';
import type { CaseTransition } from '../workflow.ts';
import { z } from "zod";
import { ApiError as SafeApiError, normalizeApiError } from "../../../services/apiError.ts";
import type { ApiError } from "../../../services/apiError.ts";
import type { CasesService } from "../services/createCasesService.ts";
import { readCaseQuery } from "../query.ts";
import { casesReducer, initialCasesState, initialEvidenceMutation, initialEvidenceSnapshot } from "./state.ts";
import { evidenceCreateSchema } from '../schemas.ts';
import type { EvidenceCreate } from '../schemas.ts';
import type { Graph } from '../../reconstruction/schemas.ts';
import type { CasesScope, CasesState } from "./state.ts";

import type { ReconstructionService } from '../../reconstruction/services/createReconstructionService.ts';
import type { LinkReviewService } from '../../link-review/services/createLinkReviewService.ts';
import { manualLinkCreateSchema, manualLinkIssue, reviewCreateSchema } from '../../link-review/schemas.ts';
import type { ReviewCreate, ManualLinkCreate } from '../../link-review/schemas.ts';
import type { SandboxService } from '../../case-sandbox/service.ts';
import { sandboxFailure } from '../../case-sandbox/service.ts';
import { commandSchema, attemptSchema } from '../../case-sandbox/schemas.ts';
import type { Command } from '../../case-sandbox/schemas.ts';
import { initialSandboxState } from '../../case-sandbox/state.ts';
export type CasesView =
  | { kind: "none" }
  | { kind: "list"; search: string }
  | { kind: "detail"; search: string; caseId: string };
const scopeId = (scope: CasesScope) =>
  JSON.stringify([scope.subject, scope.workspaceId]);
export function createCasesController(
  service: Pick<CasesService, "listCases" | "getCase">,
  revalidate: () => Promise<void>,
  evidence?: Pick<CasesService, 'addEvidence'> & { getGraph: (wid: string, rid: string, signal?: AbortSignal) => Promise<Graph> },
  workflow?: Pick<CasesService, 'transitionCase'> & { listAssignees?: CasesService['listAssignees']; now?: () => number; newKey?: () => string },
  savedRun?: Pick<ReconstructionService, 'getRun'> & Pick<LinkReviewService, 'reviewLink' | 'createManualLink'>,
  sandboxService?: SandboxService,
) {
  let state = initialCasesState();
  let view: CasesView = { kind: "none" };
  let generation = 0;
  let request: AbortController | null = null;
  let busy = false;
  let snapshotRequest: AbortController | null = null;
  let snapshotSequence = 0;
  let assigneesRequest: AbortController | null = null;
  let sandboxRequest: AbortController | null = null;
  let blocked: { key: string; error: ApiError } | null = null;
  const listeners = new Set<() => void>();
  function reset(next: CasesState) {
    state = casesReducer(state, { type: "reset", state: next });
    listeners.forEach((listener) => listener());
  }
  function update(patch: Partial<CasesState>) {
    state = casesReducer(state, { type: "update", patch });
    listeners.forEach((listener) => listener());
  }
  function abort() {
    generation++;
    request?.abort();
    snapshotRequest?.abort();
    assigneesRequest?.abort();
    sandboxRequest?.abort();
    snapshotSequence++;
    busy = false;
  }
  function deny(error: ApiError) {
    const scope = state.scope;
    if (!scope) return;
    const first = blocked?.key !== scopeId(scope);
    blocked = { key: scopeId(scope), error };
    abort();
    reset({
      ...initialCasesState(scope, state.filters),
      status: error.kind === "auth" ? "reauth" : "blocked",
      error,
    });
    if (error.kind !== "auth" && first)
      void revalidate().catch(() => undefined);
  }
  async function load(
    index = 0,
    history: (string | null)[] = [null],
    retainDetail = false,
  ): Promise<void> {
    if (
      busy ||
      !state.scope ||
      state.status !== "active" ||
      view.kind === "none"
    )
      return;
    const scope = state.scope;
    const currentView = view;
    const filters = state.filters;
    const previousDetail = retainDetail ? state.detail.data : null;
    const controller = new AbortController();
    request = controller;
    const version = generation;
    const current = () =>
      version === generation &&
      !controller.signal.aborted &&
      request === controller;
    busy = true;
    if (currentView.kind === "list")
      update({
        index,
        history,
        nextCursor: null,
        list: { status: "loading", items: [], error: null },
      });
    else
      update({
        detail: {
          status: "loading",
          id: currentView.caseId,
          data: previousDetail,
          error: null,
        },
      });
    try {
      if (currentView.kind === "list") {
        const cursor = history[index];
        const page = await service.listCases(scope.workspaceId, filters, {
          signal: controller.signal,
          ...(cursor ? { cursor } : {}),
          limit: filters.limit,
        });
        if (current())
          update({
            list: { status: "ready", items: page.items, error: null },
            nextCursor: page.next_cursor,
          });
      } else {
        const detail = await service.getCase(
          scope.workspaceId,
          currentView.caseId,
          controller.signal,
        );
        if (current()) {
          const runChanged = previousDetail !== null && previousDetail.case.run_id !== detail.case.run_id;
          if (runChanged || detail.case.state !== 'new') assigneesRequest?.abort();
          if (runChanged) { snapshotRequest?.abort(); snapshotSequence++; }
          update({
            ...(runChanged || detail.case.state !== 'new' ? { assignees: initialCasesState().assignees } : {}),
            detail: {
              status: "ready",
              id: currentView.caseId,
              data: detail,
              error: null,
            },
            ...(state.workflow.status === 'success' && state.workflow.attempt?.body.action === 'reopen' && detail.case.state !== 'closed' && state.evidenceMutation.status === 'locked' ? { evidenceMutation: initialEvidenceMutation() } : {}),
            ...(state.linkMutation.status === 'locked' && detail.case.state !== 'closed' ? { linkMutation: initialCasesState().linkMutation } : {}),
            ...(runChanged ? { caseRun: initialCasesState().caseRun, linkMutation: initialCasesState().linkMutation, snapshot: initialEvidenceSnapshot(), evidenceMutation: initialEvidenceMutation(), workflow: initialCasesState().workflow, workflowGraph: initialCasesState().workflowGraph } : {}),
          });
        }
      }
    } catch (error: unknown) {
      if (!current()) return;
      if (axios.isCancel(error)) {
        if (currentView.kind === 'list') update({ list: { status: 'idle', items: [], error: null } });
        else update({ detail: { status: 'idle', id: currentView.caseId, data: previousDetail, error: null } });
        return;
      }
      const safe = normalizeApiError(error);
      if (safe.kind === "auth" || safe.status === 403 || safe.status === 404)
        deny(safe);
      else if (currentView.kind === "list") {
        update({
          list: { status: "error", items: [], error: safe },
          nextCursor: null,
          ...(safe.code === "INVALID_CURSOR"
            ? { history: [null], index: 0, detail: initialCasesState().detail }
            : {}),
        });
      } else
        update({
          detail: {
            status: "error",
            id: currentView.caseId,
            data: previousDetail,
            error: safe,
          },
        });
    } finally {
      if (current()) busy = false;
    }
  }
  function sync(scope: CasesScope | null, nextView: CasesView) {
    const previousView = view;
    view = nextView;
    if (!scope || nextView.kind === "none") {
      abort();
      reset(initialCasesState());
      return;
    }
    const query = readCaseQuery(nextView.search);
    if (
      !query.success ||
      (nextView.kind === "detail" &&
        !z.uuid().safeParse(nextView.caseId).success)
    ) {
      abort();
      reset({ ...initialCasesState(scope), status: "invalid" });
      return;
    }
    const same =
      state.scope?.accessKey === scope.accessKey &&
      state.scope.workspaceId === scope.workspaceId &&
      state.scope.subject === scope.subject;
    const samePermissions = state.scope?.canWrite === scope.canWrite && state.scope?.canVerify === scope.canVerify && state.scope?.canAdmin === scope.canAdmin;
    if (blocked && blocked.key !== scopeId(scope)) blocked = null;
    if (blocked) {
      abort();
      reset({
        ...initialCasesState(scope, query.filters),
        status: blocked.error.kind === "auth" ? "reauth" : "blocked",
        error: blocked.error,
      });
      return;
    }
    if (
      !same ||
      !samePermissions ||
      state.status === 'invalid' ||
      previousView.kind !== nextView.kind ||
      (previousView.kind === "detail" &&
        nextView.kind === "detail" &&
        previousView.caseId !== nextView.caseId) ||
      JSON.stringify(state.filters) !== JSON.stringify(query.filters)
    ) {
      abort();
      reset(initialCasesState(scope, query.filters));
      void load();
    }
  }
  function refresh(): Promise<void> {
    if (busy) return Promise.resolve();
    if (
      !state.scope ||
      view.kind === "none" ||
      state.status === "reauth" ||
      state.status === "invalid"
    )
      return Promise.resolve();
    blocked = null;
    if (view.kind === 'detail' && state.detail.data) return load(0, [null], true);
    abort();
    reset(initialCasesState(state.scope, state.filters));
    return load();
  }
  function page(direction: -1 | 1): Promise<void> {
    if (busy || view.kind !== "list" || state.status !== "active")
      return Promise.resolve();
    const index = state.index + direction;
    if (index < 0 || (direction === 1 && !state.nextCursor))
      return Promise.resolve();
    const history =
      direction === 1
        ? [...state.history.slice(0, state.index + 1), state.nextCursor]
        : state.history;
    return load(index, history);
  }
  function readable() {
    return state.status === 'active' && state.scope !== null && view.kind === 'detail' &&
      state.detail.status === 'ready' && state.detail.id === view.caseId && state.detail.data !== null;
  }
  function acceptGraph(graph: Graph) {
    update({ snapshot: { status: 'ready', runId: graph.run_id, events: graph.nodes, graph, error: null },
      workflowGraph: { status: 'ready', runId: graph.run_id, pendingCount: graph.links.filter(link => link.review_state === 'pending').length, error: null } });
  }
  function editable() {
    return state.status === 'active' && state.scope?.canWrite === true && view.kind === 'detail' &&
      state.detail.status === 'ready' && state.detail.id === view.caseId && state.detail.data !== null &&
      state.detail.data.case.state !== 'closed';
  }
  async function loadEvidenceSnapshot(force = false): Promise<void> {
    if (!evidence || busy || state.caseRun.status === 'loading' || !readable() || !state.scope || !state.detail.data || state.snapshot.status === 'loading') return;
    const wid = state.scope.workspaceId;
    const rid = state.detail.data.case.run_id;
    const cid = state.detail.data.case.id;
    if (!force && state.snapshot.status === 'ready' && state.snapshot.runId === rid) return;
    snapshotRequest?.abort();
    const controller = new AbortController();
    snapshotRequest = controller;
    const version = generation;
    const sequence = ++snapshotSequence;
    const current = () => version === generation && sequence === snapshotSequence && !controller.signal.aborted;
    update({ snapshot: { status: 'loading', runId: rid, events: [], error: null }, workflowGraph: { status: 'loading', runId: rid, pendingCount: null, error: null } });
    try {
      const graph = await evidence.getGraph(wid, rid, controller.signal);
      if (!current()) return;
      if (graph.run_id !== rid || state.detail.id !== cid || (state.caseRun.run?.id === rid && !graph.nodes.some(node => node.event_id === state.caseRun.run?.root_event_id))) throw new SafeApiError({ kind: 'client', code: 'INVALID_API_RESPONSE', message: 'Snapshot không đúng run của case.' });
      acceptGraph(graph);
    } catch (error: unknown) {
      if (!current()) return;
      if (axios.isCancel(error)) { update({ snapshot: initialEvidenceSnapshot() }); return; }
      const safe = normalizeApiError(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) deny(safe);
      else update({ snapshot: { status: 'error', runId: rid, events: [], error: safe }, workflowGraph: { status: 'error', runId: rid, pendingCount: null, error: safe } });
    }
  }
  async function submitEvidence(input: EvidenceCreate): Promise<void> {
    if (!evidence || busy || state.workflow.status === 'uncertain' || !editable() || !state.scope || !state.detail.data ||
      ['sending', 'uncertain', 'locked'].includes(state.evidenceMutation.status)) return;
    const parsed = evidenceCreateSchema.safeParse(input);
    const detail = state.detail.data;
    if (!parsed.success || (input.kind === 'note' && input.event_ids.length > 0) ||
      (input.kind === 'events' && (state.snapshot.status !== 'ready' || state.snapshot.runId !== detail.case.run_id ||
      input.event_ids.some(id => !state.snapshot.events.some(event => event.event_id === id))))) {
      update({ evidenceMutation: { status: 'error', savedId: null, error: new SafeApiError({ kind: 'client', code: 'INVALID_EVIDENCE_INPUT', message: 'Kiểm tra note và các event thuộc snapshot của case.' }) } });
      return;
    }
    const wid = state.scope.workspaceId;
    const cid = detail.case.id;
    const version = generation;
    const controller = new AbortController();
    request = controller;
    const current = () => version === generation && !controller.signal.aborted;
    busy = true;
    update({ evidenceMutation: { status: 'sending', savedId: null, error: null } });
    let refetch = false;
    try {
      const result = await evidence.addEvidence(wid, cid, parsed.data, controller.signal);
      if (!current()) return;
      update({ evidenceMutation: { status: 'success', savedId: result.id, error: null } });
      refetch = true;
    } catch (error: unknown) {
      if (!current()) return;
      const safe = normalizeApiError(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) { deny(safe); return; }
      const uncertain = axios.isCancel(error) || safe.kind === 'network' || safe.kind === 'timeout' || safe.code === 'INVALID_API_RESPONSE' || (safe.status ?? 0) >= 500;
      const locked = safe.code === 'CASE_CLOSED';
      update({ evidenceMutation: { status: uncertain ? 'uncertain' : locked ? 'locked' : 'error', savedId: null, error: axios.isCancel(error) ? null : safe } });
      refetch = uncertain || locked;
    } finally { if (current()) busy = false; }
    if (refetch && current()) await load(0, [null], true);
  }
  function beginNewEvidence() {
    if (!busy && editable() && state.evidenceMutation.status === 'uncertain') update({ evidenceMutation: initialEvidenceMutation() });
  }
  async function loadCaseAssignees(): Promise<void> {
    if (!workflow?.listAssignees || busy || !readable() || !state.scope?.canWrite || state.detail.data?.case.state !== 'new' || state.assignees.status === 'loading') return;
    const scope = state.scope, cid = state.detail.data.case.id;
    const controller = new AbortController();
    assigneesRequest?.abort(); assigneesRequest = controller;
    const version = generation;
    const current = () => version === generation && assigneesRequest === controller && !controller.signal.aborted;
    update({ assignees: { status: 'loading', items: [], error: null } });
    try {
      const result = await workflow.listAssignees(scope.workspaceId, cid, controller.signal);
      if (current()) update({ assignees: { status: 'ready', items: result.items, error: null } });
    } catch (error: unknown) {
      if (!current()) return;
      const safe = normalizeApiError(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) deny(safe);
      else update({ assignees: { status: 'error', items: [], error: safe } });
    }
  }
  async function executeTransition(input: CaseTransition, replay: boolean): Promise<void> {
    if (!workflow || busy || state.snapshot.status === 'loading' || state.caseRun.status === 'loading' || state.status !== 'active' || !state.scope?.canWrite || view.kind !== 'detail' || state.detail.status !== 'ready' || !state.detail.data || state.evidenceMutation.status === 'uncertain') return;
    const retained = state.workflow.attempt;
    if ((!replay && retained) || (replay && (state.workflow.status !== 'uncertain' || !retained))) return;
    const parsed = transitionSchema.safeParse(replay && retained ? retained.body : input);
    if (!parsed.success) return;
    const scope = state.scope;
    const original = state.detail.data;
    const now = workflow.now ?? Date.now;
    const fail = (code: string, message: string) => new SafeApiError({ kind: 'client', code, message });
    const expired = () => retained !== null && now() - retained.createdAt >= 86400000;
    if (replay && expired()) {
      update({ workflow: { ...state.workflow, error: fail('IDEMPOTENCY_EXPIRED', 'Đã hết 24 giờ; đọc detail rồi bắt đầu thao tác mới nếu cần.') } }); return;
    }
    const controller = new AbortController();
    request = controller;
    const version = generation;
    const current = () => version === generation && !controller.signal.aborted;
    busy = true;
    assigneesRequest?.abort();
    update({ assignees: initialCasesState().assignees });
    let posted = false;
    let refetch = false;
    update({ workflow: { ...state.workflow, status: 'validating', error: null, resultVersion: null } });
    try {
      const latest = await service.getCase(scope.workspaceId, original.case.id, controller.signal);
      if (!current()) return;
      if (latest.case.run_id !== original.case.run_id) throw fail('INVALID_API_RESPONSE', 'Run của case đã thay đổi; tải lại detail.');
      update({ detail: { status: 'ready', id: latest.case.id, data: latest, error: null } });
      if (replay && expired()) throw fail('IDEMPOTENCY_EXPIRED', 'Đã hết 24 giờ; không gửi lại thao tác.');
      if (!replay) {
        if (latest.case.version !== parsed.data.expected_version) throw fail('VERSION_CONFLICT', 'Case đã thay đổi. Đọc detail mới và chủ động dùng version hiện tại.');
        const issue = transitionIssue(latest, scope, parsed.data.action, parsed.data.reason);
        if (issue) throw fail('GUARD_FAILED', issue);
        if (parsed.data.action === 'assign' && workflow.listAssignees) {
          const result = await workflow.listAssignees(scope.workspaceId, latest.case.id, controller.signal);
          if (!current()) return;
          update({ assignees: { status: 'ready', items: result.items, error: null } });
          if (!result.items.some(item => item.subject === parsed.data.owner_id && item.roles.some(role => role === 'operator' || role === 'reviewer'))) throw fail('ASSIGNEE_UNAVAILABLE', 'Người nhận không còn đủ điều kiện. Chọn lại từ danh sách mới.');
        }
        if (parsed.data.action === 'verify_close') {
          if (!evidence) throw fail('GUARD_FAILED', 'Chưa thể kiểm tra pending links.');
          update({ workflowGraph: { status: 'loading', runId: latest.case.run_id, pendingCount: null, error: null } });
          const graph = await evidence.getGraph(scope.workspaceId, latest.case.run_id, controller.signal);
          if (!current()) return;
          if (graph.run_id !== latest.case.run_id) throw fail('INVALID_API_RESPONSE', 'Graph không đúng run.');
          const pending = graph.links.filter(link => link.review_state === 'pending').length;
          acceptGraph(graph);
          const graphIssue = transitionIssue(latest, scope, parsed.data.action, parsed.data.reason, pending);
          if (graphIssue) throw fail('GUARD_FAILED', graphIssue);
        }
      }
      const attempt = replay && retained ? retained : { body: parsed.data, key: (workflow.newKey ?? (() => crypto.randomUUID()))(), createdAt: now() };
      update({ workflow: { status: 'sending', attempt, error: null, resultVersion: null } });
      posted = true;
      const result = await workflow.transitionCase(scope.workspaceId, original.case.id, attempt.body, { idempotencyKey: attempt.key, signal: controller.signal });
      if (!current()) return;
      if (result.run_id !== original.case.run_id) throw fail('INVALID_API_RESPONSE', 'Response không đúng run của case.');
      update({ workflow: { ...state.workflow, status: 'success', error: null, resultVersion: result.version } });
      refetch = true;
    } catch (error: unknown) {
      if (!current()) return;
      const safe = normalizeApiError(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) { deny(safe); return; }
      const uncertain = (replay && !posted) || (posted && (axios.isCancel(error) || safe.kind === 'network' || safe.kind === 'timeout' || safe.code === 'INVALID_API_RESPONSE' || (safe.status ?? 0) >= 500));
      update({ workflow: { ...state.workflow, status: uncertain ? 'uncertain' : safe.code === 'VERSION_CONFLICT' || safe.status === 409 ? 'conflict' : 'error', error: safe }, workflowGraph: { ...state.workflowGraph, status: state.workflowGraph.status === 'loading' ? 'error' : state.workflowGraph.status, error: state.workflowGraph.status === 'loading' ? safe : state.workflowGraph.error } });
      refetch = posted || safe.status === 409 || safe.status === 422 || safe.code === 'VERSION_CONFLICT';
    } finally { if (current()) busy = false; }
    if (refetch && current()) await load(0, [null], true);
    if (current() && parsed.data.action === 'assign' && state.workflow.status === 'error' && state.workflow.error?.status === 422) await loadCaseAssignees();
    if (refetch && current() && sandboxService) await loadSandbox();
  }
  async function loadCaseRun(force = false): Promise<void> {
    if (!savedRun || busy || state.snapshot.status === 'loading' || !readable() || !state.scope || !state.detail.data) return;
    if (state.caseRun.status === 'loading') return;
    const scope = state.scope, detail = state.detail.data;
    if (!force && state.caseRun.status === 'ready' && state.caseRun.run?.id === detail.case.run_id && state.snapshot.status === 'ready') return;
    const controller = new AbortController();
    snapshotRequest?.abort(); snapshotRequest = controller;
    const version = generation, sequence = ++snapshotSequence;
    const current = () => version === generation && sequence === snapshotSequence && !controller.signal.aborted;
    update({ caseRun: { status: 'loading', run: null, error: null } });
    try {
      const run = await savedRun.getRun(scope.workspaceId, detail.case.run_id, controller.signal);
      if (!current()) return;
      if (run.id !== detail.case.run_id) throw new SafeApiError({ kind: 'client', code: 'INVALID_API_RESPONSE', message: 'Lần tái dựng không đúng hồ sơ.' });
      update({ caseRun: { status: 'ready', run, error: null } });
    } catch (error: unknown) {
      if (!current()) return;
      const safe = normalizeApiError(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) deny(safe);
      else update({ caseRun: { status: 'error', run: null, error: safe } });
      return;
    }
    if (current() && state.caseRun.run?.status === 'completed') await loadEvidenceSnapshot(force);
  }
  async function mutateCaseLink(input: { kind: 'review'; id: string; body: ReviewCreate } | { kind: 'manual'; body: ManualLinkCreate }): Promise<void> {
    if (!savedRun || !editable() || busy || !state.scope || !state.detail.data || state.snapshot.status !== 'ready' || !state.snapshot.graph ||
      state.caseRun.run?.status !== 'completed' || state.evidenceMutation.status === 'uncertain' || state.workflow.status === 'uncertain') return;
    const graph = state.snapshot.graph, scope = state.scope, original = state.detail.data;
    const link = input.kind === 'review' ? graph.links.find(item => item.id === input.id) : undefined;
    const parsed = input.kind === 'review' ? reviewCreateSchema.safeParse(input.body) : manualLinkCreateSchema.safeParse(input.body);
    let issue: string | null = null;
    if (!parsed.success) issue = 'INVALID_LINK_INPUT';
    else if (input.kind === 'manual') issue = manualLinkIssue(input.body, graph);
    else if (!link) issue = 'INVALID_LINK_INPUT';
    else if (link.version !== input.body.expected_version) issue = 'VERSION_CONFLICT';
    if (issue) {
      update({ linkMutation: { status: issue === 'VERSION_CONFLICT' ? 'conflict' : issue === 'LINK_EXISTS' ? 'duplicate' : 'error', error: new SafeApiError({ kind: 'client', code: issue, message: 'Kiểm tra liên kết, phiên bản và lý do.' }), linkId: input.kind === 'review' ? input.id : null } });
      if (issue === 'VERSION_CONFLICT' || issue === 'LINK_EXISTS') await loadEvidenceSnapshot(true);
      return;
    }
    if (graph.run_id !== original.case.run_id) return;
    const controller = new AbortController(); request = controller;
    snapshotRequest?.abort(); snapshotSequence++;
    const version = generation;
    const current = () => generation === version && !controller.signal.aborted;
    busy = true;
    let posted = false;
    let refetchCase = false;
    update({ linkMutation: { status: 'sending', error: null, linkId: input.kind === 'review' ? input.id : null } });
    try {
      const latest = await service.getCase(scope.workspaceId, original.case.id, controller.signal);
      if (!current()) return;
      if (latest.case.run_id !== original.case.run_id) throw new SafeApiError({ kind: 'client', code: 'RUN_CHANGED', message: 'Lần tái dựng của hồ sơ đã đổi. Tải lại hồ sơ.' });
      update({ detail: { status: 'ready', id: latest.case.id, data: latest, error: null } });
      if (latest.case.state === 'closed') throw new SafeApiError({ kind: 'client', code: 'CASE_CLOSED', message: 'Hồ sơ đã đóng; không thể sửa liên kết.' });
      posted = true;
      if (input.kind === 'review') await savedRun.reviewLink(scope.workspaceId, graph.run_id, input.id, reviewCreateSchema.parse(input.body), controller.signal);
      else await savedRun.createManualLink(scope.workspaceId, graph.run_id, manualLinkCreateSchema.parse(input.body), controller.signal);
      if (!current()) return;
      update({ linkMutation: { status: 'success', error: null, linkId: input.kind === 'review' ? input.id : null } });
    } catch (error: unknown) {
      if (!current()) return;
      const safe = normalizeApiError(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) { deny(safe); return; }
      const uncertain = posted && (safe.kind === 'network' || safe.kind === 'timeout' || safe.code === 'INVALID_API_RESPONSE' || (safe.status ?? 0) >= 500);
      update({ linkMutation: { status: uncertain ? 'uncertain' : safe.code === 'VERSION_CONFLICT' ? 'conflict' : safe.code === 'CASE_CLOSED' ? 'locked' : safe.code === 'LINK_EXISTS' ? 'duplicate' : 'error', error: safe, linkId: input.kind === 'review' ? input.id : null } });
      refetchCase = safe.code === 'RUN_CHANGED' || safe.code === 'CASE_CLOSED';
      if (safe.code === 'RUN_CHANGED') {
        update({ snapshot: initialEvidenceSnapshot(), caseRun: initialCasesState().caseRun, workflowGraph: initialCasesState().workflowGraph });
      }
    } finally { if (current()) busy = false; }
    if (current() && refetchCase) { await load(0, [null], true); return; }
    if (current()) await loadEvidenceSnapshot(true);
  }
  const reviewCaseLink = (id: string, body: ReviewCreate) => mutateCaseLink({ kind: 'review', id, body });
  const createCaseManualLink = (body: ManualLinkCreate) => mutateCaseLink({ kind: 'manual', body });
  function retryTransition() {
    const attempt = state.workflow.attempt;
    return attempt ? executeTransition(attempt.body, true) : Promise.resolve();
  }
  function beginNewTransition() {
    if (!busy && state.detail.status === 'ready' && state.status === 'active') update({ workflow: initialCasesState().workflow });
  }
  async function loadSandbox(): Promise<void> {
    if (!sandboxService || busy || !readable() || !state.scope || !state.detail.data || state.detail.status !== 'ready') return;
    const scope = state.scope, cid = state.detail.data.case.id;
    sandboxRequest?.abort();
    const controller = new AbortController(); sandboxRequest = controller;
    const version = generation;
    const caseVersion = state.detail.data.case.version;
    const current = () => generation === version && sandboxRequest === controller && !controller.signal.aborted && state.detail.data?.case.version === caseVersion;
    function failRead(error: unknown): never {
      const safe = sandboxFailure(error);
      if (current() && (safe.kind === 'auth' || safe.status === 403 || safe.status === 404)) deny(safe);
      throw error;
    }
    update({ sandbox: { ...state.sandbox,
      snapshot: { ...state.sandbox.snapshot, status: 'loading', error: null },
      proofs: { ...state.sandbox.proofs, status: 'loading', error: null }, lab: { ...state.sandbox.lab, status: 'loading', error: null } } });
    try {
      const results = await Promise.allSettled([
        sandboxService.getSandbox(scope.workspaceId, cid, controller.signal).catch(failRead),
        sandboxService.getProofs(scope.workspaceId, cid, controller.signal).catch(failRead),
        sandboxService.getLab(scope.workspaceId, controller.signal).catch(failRead),
      ]);
      if (!current()) return;
      for (const result of results) if (result.status === 'rejected') {
        const safe = sandboxFailure(result.reason);
        if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) { deny(safe); return; }
      }
      const [snapshot, proofs, lab] = results;
      update({ sandbox: { ...state.sandbox,
        snapshot: snapshot.status === 'fulfilled' ? { status: 'ready', data: snapshot.value, error: null } : { status: 'error', data: state.sandbox.snapshot.data, error: sandboxFailure(snapshot.reason) },
        proofs: proofs.status === 'fulfilled' ? { status: 'ready', data: proofs.value, error: null } : { status: 'error', data: state.sandbox.proofs.data, error: sandboxFailure(proofs.reason) },
        lab: lab.status === 'fulfilled' ? { status: 'ready', data: lab.value, error: null } : { status: 'error', data: state.sandbox.lab.data, error: sandboxFailure(lab.reason) },
        mutation: { ...state.sandbox.mutation, reconciled: state.sandbox.mutation.kind === 'proof' ? proofs.status === 'fulfilled' : snapshot.status === 'fulfilled' },
      } });
    } finally { if (sandboxRequest === controller) sandboxRequest = null; }
  }
  async function mutateSandbox(input: Command | null, replay = false): Promise<void> {
    if (!sandboxService || busy || !readable() || !state.scope || state.detail.status !== 'ready' || !state.detail.data || state.detail.data.case.state === 'closed' || state.snapshot.status === 'loading' || state.caseRun.status === 'loading') return;
    if (state.workflow.status === 'uncertain' || state.evidenceMutation.status === 'uncertain' || state.linkMutation.status === 'uncertain') return;
    const scope = state.scope, detail = state.detail.data.case, previous = state.sandbox.mutation;
    const retained = previous.intent;
    if (replay && (!previous.reconciled || retained?.action !== 'provision' || !['uncertain', 'conflict'].includes(previous.status))) return;
    if (!replay && previous.status !== 'idle') return;
    const body = replay ? retained : input;
    if (body) {
      if (body.action === 'provision' ? !scope.canWrite : !scope.canAdmin) return;
      if (!commandSchema.safeParse(body).success) return;
      const observed = state.sandbox.snapshot;
      if (observed.status !== 'ready' || !observed.data) return;
      if (observed.data.observation.source !== 'lab-sandbox' || observed.data.observation.simulated !== true || observed.data.observation.source_version === undefined) return;
      if (!replay && (body.expected_case_version !== observed.data.case_version || body.expected_case_version !== detail.version || body.expected_version !== observed.data.observation.source_version)) {
        update({ sandbox: { ...state.sandbox, mutation: { ...previous, status: 'conflict', intent: body, kind: 'command', reconciled: false, error: new SafeApiError({ kind: 'client', code: 'VERSION_CONFLICT', message: 'Đọc dữ liệu mới và xác nhận phiên bản trước khi gửi.' }) } } });
        await loadSandbox(); return;
      }
      const conditions = observed.data.observation.conditions;
      if ((body.action === 'image' && body.image_id !== conditions?.image_id) || (body.action === 'account' && body.account_id !== conditions?.account_id)) return;
    } else if (!scope.canVerify || detail.state !== 'awaiting_verification' || state.sandbox.proofs.status !== 'ready' || state.sandbox.snapshot.status !== 'ready' || state.sandbox.snapshot.data?.case_version !== detail.version) return;
    sandboxRequest?.abort();
    const controller = new AbortController(); request = controller;
    const version = generation;
    const current = () => generation === version && request === controller && !controller.signal.aborted;
    busy = true;
    update({ sandbox: { ...state.sandbox, mutation: { ...previous, status: 'sending', kind: body ? 'command' : 'proof', intent: body, error: null, execution: null, savedProof: null, reconciled: false } } });
    try {
      if (body) {
        const result = await sandboxService.command(scope.workspaceId, detail.id, body, controller.signal);
        if (!current()) return;
        update({ sandbox: { ...state.sandbox, snapshot: { status: 'ready', data: result, error: null }, mutation: { ...state.sandbox.mutation, status: 'success', execution: result.execution ?? null } } });
      } else {
        const proof = await sandboxService.verify(scope.workspaceId, detail.id, controller.signal);
        if (!current()) return;
        update({ sandbox: { ...state.sandbox, mutation: { ...state.sandbox.mutation, status: 'success', savedProof: proof } } });
      }
    } catch (error: unknown) {
      if (!current()) return;
      const safe = sandboxFailure(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) { deny(safe); return; }
      const uncertain = axios.isCancel(error) || safe.kind === 'timeout' || safe.kind === 'network' || safe.code === 'INVALID_API_RESPONSE' || (safe.status ?? 0) >= 500;
      update({ sandbox: { ...state.sandbox, mutation: { ...state.sandbox.mutation, status: uncertain ? 'uncertain' : safe.status === 409 || safe.code === 'VERSION_CONFLICT' ? 'conflict' : 'error', error: safe } } });
    } finally { if (current()) busy = false; }
    if (!current()) return;
    await load(0, [null], true);
    if (generation === version && state.status === 'active') await loadSandbox();
  }
  function beginSandboxIntent() {
    if (busy || !readable() || state.sandbox.mutation.status === 'sending') return;
    const old = state.sandbox.mutation;
    if (['uncertain', 'conflict'].includes(old.status) && !old.reconciled) return;
    if (old.status === 'uncertain' && old.intent?.action === 'provision') {
      const operation = old.intent.operation_id;
      if (!state.sandbox.snapshot.data?.observation.attempts?.some(item => { const parsed = attemptSchema.safeParse(item); return parsed.success && parsed.data.operation_id === operation; })) return;
    }
    update({ sandbox: { ...state.sandbox, mutation: initialSandboxState().mutation } });
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
    loadSandbox, submitSandboxCommand: (body: Command) => mutateSandbox(body), saveSandboxProof: () => mutateSandbox(null),
    retrySandboxProvision: () => mutateSandbox(state.sandbox.mutation.intent, true), beginSandboxIntent,
    refresh,
    loadEvidenceSnapshot, loadCaseRun, loadCaseAssignees, reviewCaseLink, createCaseManualLink, submitEvidence, beginNewEvidence,
    submitTransition: (input: CaseTransition) => executeTransition(input, false), retryTransition, beginNewTransition,
    previousPage: () => page(-1),
    nextPage: () => page(1),
    stop() {
      abort();
      blocked = null;
      view = { kind: "none" };
      reset(initialCasesState());
    },
  };
}
