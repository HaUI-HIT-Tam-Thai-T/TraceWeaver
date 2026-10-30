// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

// Loaded only by the container commands. Keep host DATABASE_URL and .env untouched.
if (!process.env.DATABASE_URL) {
  const { DATABASE_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
  if (!DATABASE_HOST || !POSTGRES_DB || !POSTGRES_USER || !POSTGRES_PASSWORD) {
    throw new Error('Container database configuration is incomplete');
  }
  const url = new URL('postgresql://postgres:5432/');
  url.hostname = DATABASE_HOST;
  url.pathname = `/${encodeURIComponent(POSTGRES_DB)}`;
  url.username = encodeURIComponent(POSTGRES_USER);
  url.password = encodeURIComponent(POSTGRES_PASSWORD);
  process.env.DATABASE_URL = url.href;
}
