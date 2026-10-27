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

export type CasesView =
  | { kind: "none" }
  | { kind: "list"; search: string }
  | { kind: "detail"; search: string; caseId: string };
const scopeId = (scope: CasesScope) =>
  JSON.stringify([scope.subject, scope.workspaceId]);
export function createCasesController(
  service: Pick<CasesService, "listCases" | "getCase">,
  revalidate: () => Promise<void>,
  evidence?: { addEvidence: CasesService['addEvidence']; getGraph: (wid: string, rid: string, signal?: AbortSignal) => Promise<Graph> },
  workflow?: { transitionCase: CasesService['transitionCase']; now?: () => number; newKey?: () => string },
) {
  let state = initialCasesState();
  let view: CasesView = { kind: "none" };
  let generation = 0;
  let request: AbortController | null = null;
  let busy = false;
  let snapshotRequest: AbortController | null = null;
  let snapshotSequence = 0;
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
          if (runChanged) { snapshotRequest?.abort(); snapshotSequence++; }
          update({
            detail: {
              status: "ready",
              id: currentView.caseId,
              data: detail,
              error: null,
            },
            ...(state.workflow.status === 'success' && state.workflow.attempt?.body.action === 'reopen' && detail.case.state !== 'closed' && state.evidenceMutation.status === 'locked' ? { evidenceMutation: initialEvidenceMutation() } : {}),
            ...(runChanged ? { snapshot: initialEvidenceSnapshot(), evidenceMutation: initialEvidenceMutation(), workflow: initialCasesState().workflow, workflowGraph: initialCasesState().workflowGraph } : {}),
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
    const samePermissions = state.scope?.canWrite === scope.canWrite && state.scope?.canVerify === scope.canVerify;
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
  function editable() {
    return state.status === 'active' && state.scope?.canWrite === true && view.kind === 'detail' &&
      state.detail.status === 'ready' && state.detail.id === view.caseId && state.detail.data !== null &&
      state.detail.data.case.state !== 'closed';
  }
  async function loadEvidenceSnapshot(): Promise<void> {
    if (!evidence || busy || !editable() || !state.scope || !state.detail.data || state.snapshot.status === 'loading') return;
    const wid = state.scope.workspaceId;
    const rid = state.detail.data.case.run_id;
    const cid = state.detail.data.case.id;
    if (state.snapshot.status === 'ready' && state.snapshot.runId === rid) return;
    snapshotRequest?.abort();
    const controller = new AbortController();
    snapshotRequest = controller;
    const version = generation;
    const sequence = ++snapshotSequence;
    const current = () => version === generation && sequence === snapshotSequence && !controller.signal.aborted;
    update({ snapshot: { status: 'loading', runId: rid, events: [], error: null } });
    try {
      const graph = await evidence.getGraph(wid, rid, controller.signal);
      if (!current()) return;
      if (graph.run_id !== rid || state.detail.id !== cid) throw new SafeApiError({ kind: 'client', code: 'INVALID_API_RESPONSE', message: 'Snapshot không đúng run của case.' });
      update({ snapshot: { status: 'ready', runId: rid, events: graph.nodes, error: null } });
    } catch (error: unknown) {
      if (!current()) return;
      if (axios.isCancel(error)) { update({ snapshot: initialEvidenceSnapshot() }); return; }
      const safe = normalizeApiError(error);
      if (safe.kind === 'auth' || safe.status === 403 || safe.status === 404) deny(safe);
      else update({ snapshot: { status: 'error', runId: rid, events: [], error: safe } });
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
  async function executeTransition(input: CaseTransition, replay: boolean): Promise<void> {
    if (!workflow || busy || state.status !== 'active' || !state.scope?.canWrite || view.kind !== 'detail' || state.detail.status !== 'ready' || !state.detail.data || state.evidenceMutation.status === 'uncertain') return;
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
        if (parsed.data.action === 'verify_close') {
          if (!evidence) throw fail('GUARD_FAILED', 'Chưa thể kiểm tra pending links.');
          update({ workflowGraph: { status: 'loading', runId: latest.case.run_id, pendingCount: null, error: null } });
          const graph = await evidence.getGraph(scope.workspaceId, latest.case.run_id, controller.signal);
          if (!current()) return;
          if (graph.run_id !== latest.case.run_id) throw fail('INVALID_API_RESPONSE', 'Graph không đúng run.');
          const pending = graph.links.filter(link => link.review_state === 'pending').length;
          update({ workflowGraph: { status: 'ready', runId: graph.run_id, pendingCount: pending, error: null } });
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
      update({ workflow: { ...state.workflow, status: uncertain ? 'uncertain' : safe.code === 'VERSION_CONFLICT' ? 'conflict' : 'error', error: safe }, workflowGraph: { ...state.workflowGraph, status: state.workflowGraph.status === 'loading' ? 'error' : state.workflowGraph.status, error: state.workflowGraph.status === 'loading' ? safe : state.workflowGraph.error } });
      refetch = posted || safe.code === 'VERSION_CONFLICT';
    } finally { if (current()) busy = false; }
    if (refetch && current()) await load(0, [null], true);
  }
  function retryTransition() {
    const attempt = state.workflow.attempt;
    return attempt ? executeTransition(attempt.body, true) : Promise.resolve();
  }
  function beginNewTransition() {
    if (!busy && state.detail.status === 'ready' && state.status === 'active') update({ workflow: initialCasesState().workflow });
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
    refresh,
    loadEvidenceSnapshot, submitEvidence, beginNewEvidence,
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
