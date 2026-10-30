// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

// Headless entry points. Application adapters and HTTP routing are composed by callers.
export { createDatabase, withTransaction } from './data/database.js';
export { createTokenVerifier } from './identity/token-verifier.js';
export { createAccessRepository } from './identity/access-repository.js';
export { authorize } from './identity/workspace-access.js';
export { createWorkflowEngine } from './workflow/engine.js';
export { createWorkflowRepository } from './workflow/repository.js';
