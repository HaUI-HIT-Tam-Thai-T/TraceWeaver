// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

export function createHealthController(service) {
  return {
    live(req, res) { res.json({ status: 'ok' }); },
    async ready(req, res) {
      if (await service.isReady()) return res.json({ status: 'ready' });
      return res.status(503).json({
        error: { code: 'CORE_NOT_READY', message: 'Core is not ready' },
        request_id: req.requestId,
      });
    },
  };
}
