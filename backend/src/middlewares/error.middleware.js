// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

const bodyErrors = {
      'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the limit'],
      'entity.parse.failed': [400, 'INVALID_JSON', 'Request body is not valid JSON'],
      'encoding.unsupported': [415, 'UNSUPPORTED_ENCODING', 'Request encoding is not supported'],
      'charset.unsupported': [415, 'UNSUPPORTED_CHARSET', 'Request charset is not supported'],
      'request.size.invalid': [400, 'INVALID_BODY_SIZE', 'Request body size is invalid'],
      'request.aborted': [400, 'REQUEST_ABORTED', 'Request was aborted'],
};

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' }, request_id: req.requestId });
}

export function errorHandler(logError) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const [status, code, message] = bodyErrors[error.type] ?? [500, 'INTERNAL_ERROR', 'Internal server error'];
    if (status === 500) logError({ code, request_id: req.requestId });
    res.status(status).json({ error: { code, message }, request_id: req.requestId });
  };
}
