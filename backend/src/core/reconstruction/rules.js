// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { compileRulePolicy, createCandidateGenerator } from './candidates.js';
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Strongly connected components identify all cyclic edges simultaneously, independent of pair order.
function components(eventIds, pairs) {
  const adjacency = new Map(eventIds.map((id) => [id, []]));
  for (const pair of pairs) adjacency.get(pair.from_event_id).push(pair.to_event_id);
  const index = new Map(),
    low = new Map(),
    active = new Set(),
    stack = [],
    groups = new Map();
  let next = 0,
    group = 0;
  function visit(id) {
    index.set(id, next);
    low.set(id, next++);
    stack.push(id);
    active.add(id);
    for (const target of adjacency.get(id)) {
      if (!index.has(target)) {
        visit(target);
        low.set(id, Math.min(low.get(id), low.get(target)));
      } else if (active.has(target)) low.set(id, Math.min(low.get(id), index.get(target)));
    }
    if (low.get(id) === index.get(id)) {
      let member;
      do {
        member = stack.pop();
        active.delete(member);
        groups.set(member, group);
      } while (member !== id);
      group++;
    }
  }
  for (const id of eventIds) if (!index.has(id)) visit(id);
  return groups;
}
function rootComponent(root, pairs) {
  const adjacent = new Map();
  for (const { from_event_id: from, to_event_id: to } of pairs) {
    for (const [a, b] of [
      [from, to],
      [to, from],
    ]) {
      if (!adjacent.has(a)) adjacent.set(a, []);
      adjacent.get(a).push(b);
    }
  }
  const found = new Set([root]),
    queue = [root];
  for (let index = 0; index < queue.length; index++) {
    for (const id of adjacent.get(queue[index]) ?? []) {
      if (!found.has(id)) {
        found.add(id);
        queue.push(id);
      }
    }
  }
  return found;
}

export function createRuleEngine(configuration) {
  const policy = compileRulePolicy(configuration),
    generate = createCandidateGenerator(policy);
  const rules = new Map(policy.transitions.map((rule) => [rule.id, rule]));
  return function reconstruct(input) {
    const generated = generate(input),
      invalid = new Map();
    if (policy.outcome_guard) {
      const expected = new Map([
        ['intake/request.accepted', 'success'],
        ['account/account.created', 'success'],
        ['provision/provision.completed', 'success'],
        ['provision/provision.failed', 'failed'],
      ]);
      const scoped = new Set(generated.event_ids);
      for (const event of input.events) {
        if (!scoped.has(event.event_id.toLowerCase())) continue;
        const outcome = expected.get(`${event.service}/${event.action}`);
        if (outcome && event.outcome !== outcome)
          invalid.set(
            event.event_id.toLowerCase(),
            event.outcome === 'unknown' ? 'OUTCOME_UNKNOWN' : 'OUTCOME_ACTION_MISMATCH',
          );
      }
    }
    const eligible = generated.candidates.filter(
      (pair) => !invalid.has(pair.from_event_id) && !invalid.has(pair.to_event_id),
    );
    const strong = eligible.filter((pair) => pair.has_strong_id);
    const incoming = new Map(),
      outgoing = new Map();
    const key = (pair, field) => JSON.stringify([pair.transition_id, pair[field]]);
    for (const pair of strong) {
      const inKey = key(pair, 'to_event_id'),
        outKey = key(pair, 'from_event_id');
      incoming.set(inKey, (incoming.get(inKey) ?? 0) + 1);
      outgoing.set(outKey, (outgoing.get(outKey) ?? 0) + 1);
    }
    const abstentions = [...invalid].map(([event_id, reason_code]) => ({ event_id, reason_code })),
      selected = [];
    const abstain = (pair, reason_code) =>
      abstentions.push({
        transition_id: pair.transition_id,
        from_event_id: pair.from_event_id,
        to_event_id: pair.to_event_id,
        reason_code,
      });
    for (const pair of eligible) {
      const rule = rules.get(pair.transition_id);
      if (!pair.has_strong_id) abstain(pair, 'NO_SHARED_STRONG_ID');
      else if (
        (!rule.allow_fan_in && incoming.get(key(pair, 'to_event_id')) > 1) ||
        (!rule.allow_fan_out && outgoing.get(key(pair, 'from_event_id')) > 1)
      )
        abstain(pair, 'AMBIGUOUS_MATCH');
      else selected.push(pair);
    }
    const groups = components(generated.event_ids, selected),
      acyclic = [];
    for (const pair of selected) {
      if (groups.get(pair.from_event_id) === groups.get(pair.to_event_id)) abstain(pair, 'CYCLE');
      else acyclic.push(pair);
    }
    const reachable = rootComponent(generated.root_event_id, acyclic);
    const links = acyclic
      .filter((pair) => reachable.has(pair.from_event_id))
      .map((pair) => ({
        from_event_id: pair.from_event_id,
        to_event_id: pair.to_event_id,
        method: 'rule',
        score: null,
        evidence: pair.evidence,
        review_state: 'pending',
        version: 1,
      }))
      .sort(
        (a, b) =>
          compare(a.from_event_id, b.from_event_id) || compare(a.to_event_id, b.to_event_id),
      );
    abstentions.sort(
      (a, b) =>
        compare(a.transition_id ?? a.event_id, b.transition_id ?? b.event_id) ||
        compare(a.from_event_id, b.from_event_id) ||
        compare(a.to_event_id, b.to_event_id),
    );
    return {
      rule_version: generated.rule_version,
      root_event_id: generated.root_event_id,
      event_ids: generated.event_ids.filter((id) => reachable.has(id)),
      links,
      unresolved_event_ids: generated.event_ids.filter((id) => !reachable.has(id)),
      abstentions,
      rejected_counts: generated.rejected_counts,
    };
  };
}
