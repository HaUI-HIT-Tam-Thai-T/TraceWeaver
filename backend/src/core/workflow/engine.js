// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '../identity/api-error.js';
export function createWorkflowEngine(configuration) {
  const definition = structuredClone(configuration);
  if (
    !definition ||
    typeof definition.key !== 'string' ||
    !definition.key.length ||
    !Number.isSafeInteger(definition.version) ||
    definition.version < 1 ||
    !Array.isArray(definition.states) ||
    !definition.states.includes(definition.initial) ||
    !definition.transitions ||
    !Object.keys(definition.transitions).length
  )
    throw new Error('Invalid workflow definition');
  for (const rule of Object.values(definition.transitions)) {
    if (
      !Array.isArray(rule.from) ||
      !rule.from.length ||
      rule.from.some((state) => !definition.states.includes(state)) ||
      !definition.states.includes(rule.to) ||
      !Array.isArray(rule.roles) ||
      !rule.roles.length ||
      !Array.isArray(rule.guards) ||
      rule.guards.some(
        (guard) =>
          !['true', 'positive', 'zero'].includes(guard.op) || typeof guard.fact !== 'string',
      )
    ) {
      throw new Error('Invalid workflow transition');
    }
  }
  function authorize(current, action, actor) {
    const rule = Object.hasOwn(definition.transitions, action)
      ? definition.transitions[action]
      : null;
    if (!rule) throw new ApiError(422, 'INVALID_TRANSITION', 'Workflow action is not available');
    if (
      !actor.roles.some((role) => rule.roles.includes(role)) ||
      (rule.owner_or_role &&
        actor.subject !== current.owner_subject &&
        !actor.roles.includes(rule.owner_or_role))
    ) {
      throw new ApiError(403, 'FORBIDDEN', 'Action is not permitted');
    }
    return structuredClone(rule);
  }
  return {
    snapshot: () => structuredClone(definition),
    authorize,
    transition(current, command, actor, facts) {
      const rule = authorize(current, command.action, actor);
      if (current.version !== command.expected_version)
        throw new ApiError(409, 'VERSION_CONFLICT', 'Workflow version has changed');
      if (!rule.from.includes(current.state))
        throw new ApiError(
          422,
          'INVALID_TRANSITION',
          'Action is not available in the current state',
        );
      for (const guard of rule.guards) {
        const value = facts[guard.fact];
        if (
          !(guard.op === 'true'
            ? value === true
            : guard.op === 'zero'
              ? value === 0
              : Number.isFinite(value) && value > 0)
        ) {
          throw new ApiError(422, 'GUARD_FAILED', 'Workflow requirements are not satisfied');
        }
      }
      const owner_subject = rule.assign_owner ? command.owner_subject : current.owner_subject;
      if (rule.assign_owner && !owner_subject)
        throw new ApiError(422, 'GUARD_FAILED', 'A valid owner is required');
      return { state: rule.to, owner_subject, version: current.version + 1 };
    },
  };
}
