// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../identity/api-error.js';
import { missingSteps } from './policy.js';

function adjacency(links, undirected = false) {
  const edges = new Map();
  const add = (a, b) => {
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a).push(b);
  };
  for (const link of links)
    if (link.review_state !== 'rejected') {
      add(link.from_event_id, link.to_event_id);
      if (undirected) add(link.to_event_id, link.from_event_id);
    }
  return edges;
}
function reachable(edges, root) {
  const visited = new Set(),
    stack = [root];
  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    stack.push(...(edges.get(id) ?? []));
  }
  return visited;
}
export function assertAcyclicLink(links, from, to) {
  if (from === to) throw new ApiError(422, 'SELF_LINK', 'A link must connect different events');
  if (reachable(adjacency(links), to).has(from))
    throw new ApiError(422, 'LINK_CYCLE', 'Link would create a cycle');
}
export function graphProjection(root, nodes, links) {
  const connected = reachable(adjacency(links, true), root);
  return {
    unresolved_event_ids: nodes
      .filter((event) => !connected.has(event.event_id))
      .map((event) => event.event_id),
    missing_expected_steps: missingSteps(nodes.filter((event) => connected.has(event.event_id))),
  };
}
