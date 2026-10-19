// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import pg from 'pg';

export function createDatabase(config, onIdleError = () => {}) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.poolMax,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    statement_timeout: 3000,
    query_timeout: 4000,
    application_name: 'traceweaver-backend',
  });
  pool.on('error', onIdleError);
  return pool;
}

// All statements in the callback share one checked-out connection.
export async function withTransaction(pool, work) {
  const client = await pool.connect();
  let discard;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      discard = rollbackError;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
