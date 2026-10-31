// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

export function createHealthService(checkReadiness) {
  return {
    async isReady() {
      try {
        return (await checkReadiness()) === true;
      } catch {
        return false;
      }
    },
  };
}
