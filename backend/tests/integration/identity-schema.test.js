// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { readConfig } from '../../src/config.js';
import { createDatabase, withTransaction } from '../../src/core/data/database.js';
import { loadMigrations, migrate } from '../../src/core/data/migrations.js';

test('identity/source/knowledge/audit constraints on PostgreSQL', async (t) => {
  const config = readConfig();
  const admin = createDatabase(config);
  t.after(() => admin.end());
  const name = `traceweaver_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  console.log(`Schema integration database retained: ${name}`);
  const url = new URL(config.databaseUrl);
  url.pathname = `/${name}`;
  const pool = createDatabase({ ...config, databaseUrl: url.href });
  t.after(() => pool.end());
  const migrations = await loadMigrations(
    new URL('../../src/core/data/migrations/', import.meta.url),
  );
  await migrate(pool, migrations.slice(0, 1));
  const retainedWorkspace = randomUUID();
  await pool.query('INSERT INTO core.workspaces (id,name) VALUES ($1,$2)', [
    retainedWorkspace,
    'Existing before upgrade',
  ]);
  await migrate(pool, migrations);

  await t.test('upgrade from migration 001 preserves existing workspace data', async () => {
    const result = await pool.query('SELECT name FROM core.workspaces WHERE id=$1', [
      retainedWorkspace,
    ]);
    assert.equal(result.rows[0].name, 'Existing before upgrade');
  });

  async function seed(client) {
    const a = randomUUID(),
      b = randomUUID(),
      source = randomUUID(),
      group = randomUUID();
    await client.query('INSERT INTO core.workspaces (id,name) VALUES ($1,$2),($3,$4)', [
      a,
      'A',
      b,
      'B',
    ]);
    await client.query(
      'INSERT INTO core.memberships (workspace_id,subject) VALUES ($1,$2),($3,$4)',
      [a, 'alice', b, 'bob'],
    );
    await client.query('INSERT INTO core.groups (id,workspace_id,name) VALUES ($1,$2,$3)', [
      group,
      a,
      'Operators',
    ]);
    await client.query(
      'INSERT INTO core.sources (id,workspace_id,source_key,name,service,parser_version) VALUES ($1,$2,$3,$4,$5,$6)',
      [source, a, 'intake', 'Intake', 'intake', 'intake-v1'],
    );
    return { a, b, source, group };
  }
  const rejected = async (fn, code) =>
    assert.rejects(
      withTransaction(pool, async (client) => fn(client, await seed(client))),
      { code },
    );

  await t.test(
    'duplicate membership/unknown role are rejected; admin has no automatic grants',
    async () => {
      await rejected(async (client, { a }) => {
        await client.query('INSERT INTO core.memberships (workspace_id,subject) VALUES ($1,$2)', [
          a,
          'alice',
        ]);
      }, '23505');
      await rejected(async (client, { a }) => {
        await client.query(
          'INSERT INTO core.membership_roles (workspace_id,subject,role_key) VALUES ($1,$2,$3)',
          [a, 'alice', 'super-admin'],
        );
      }, '23503');
      await withTransaction(pool, async (client) => {
        const { a } = await seed(client);
        await client.query(
          'INSERT INTO core.membership_roles (workspace_id,subject,role_key) VALUES ($1,$2,$3)',
          [a, 'alice', 'admin'],
        );
        const grants = await client.query(
          'SELECT count(*)::int AS count FROM core.source_grants WHERE workspace_id=$1',
          [a],
        );
        assert.equal(grants.rows[0].count, 0);
        const roles = await client.query('SELECT role_key FROM core.roles ORDER BY role_key');
        assert.deepEqual(
          roles.rows.map((r) => r.role_key),
          ['admin', 'ingest_service', 'operator', 'reviewer', 'viewer'],
        );
      });
    },
  );

  await t.test('group members and source grants cannot cross workspace boundaries', async () => {
    await rejected(async (client, { b, group }) => {
      await client.query(
        'INSERT INTO core.group_members (workspace_id,group_id,subject) VALUES ($1,$2,$3)',
        [b, group, 'bob'],
      );
    }, '23503');
    await rejected(async (client, { b, source }) => {
      await client.query(
        'INSERT INTO core.source_grants (id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6)',
        [randomUUID(), b, source, 'bob', 'read', 'bob'],
      );
    }, '23503');
    await rejected(async (client, { a, source }) => {
      await client.query(
        'INSERT INTO core.source_grants (id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6)',
        [randomUUID(), a, source, 'bob', 'read', 'alice'],
      );
    }, '23503');
    await rejected(async (client, { a, b, source }) => {
      const otherGroup = randomUUID();
      await client.query('INSERT INTO core.groups (id,workspace_id,name) VALUES ($1,$2,$3)', [
        otherGroup,
        b,
        'Other group',
      ]);
      await client.query(
        'INSERT INTO core.source_grants (id,workspace_id,source_id,group_id,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6)',
        [randomUUID(), a, source, otherGroup, 'read', 'alice'],
      );
    }, '23503');
  });

  await t.test('grant needs exactly one target; duplicate active grant fails', async () => {
    for (const both of [false, true]) {
      await rejected(async (client, { a, source, group }) => {
        await client.query(
          'INSERT INTO core.source_grants (id,workspace_id,source_id,grantee_subject,group_id,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [randomUUID(), a, source, both ? 'alice' : null, both ? group : null, 'read', 'alice'],
        );
      }, '23514');
    }
    await rejected(async (client, { a, source }) => {
      for (let i = 0; i < 2; i++) {
        await client.query(
          'INSERT INTO core.source_grants (id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6)',
          [randomUUID(), a, source, 'alice', 'read', 'alice'],
        );
      }
    }, '23505');
  });

  await t.test(
    'revocation retains history and allows a new grant; group grants are valid',
    async () => {
      await withTransaction(pool, async (client) => {
        const { a, source, group } = await seed(client);
        const old = randomUUID();
        await client.query(
          'INSERT INTO core.source_grants (id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6)',
          [old, a, source, 'alice', 'read', 'alice'],
        );
        await client.query(
          'UPDATE core.source_grants SET revoked_at=clock_timestamp() WHERE id=$1',
          [old],
        );
        await client.query(
          'INSERT INTO core.source_grants (id,workspace_id,source_id,grantee_subject,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6)',
          [randomUUID(), a, source, 'alice', 'read', 'alice'],
        );
        await client.query(
          'INSERT INTO core.source_grants (id,workspace_id,source_id,group_id,permission,granted_by) VALUES ($1,$2,$3,$4,$5,$6)',
          [randomUUID(), a, source, group, 'ingest', 'alice'],
        );
        const counts = await client.query(
          'SELECT count(*)::int AS total, count(*) FILTER (WHERE revoked_at IS NULL)::int AS active FROM core.source_grants WHERE workspace_id=$1',
          [a],
        );
        assert.deepEqual(counts.rows[0], { total: 3, active: 2 });
      });
    },
  );

  await t.test('knowledge version, content and provenance are required', async () => {
    await rejected(async (client, { a }) => {
      await client.query(
        'INSERT INTO core.knowledge_articles (id,workspace_id,version,title,body,author_subject,source_ref) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), a, 0, 'Guide', 'Body', 'alice', 'https://docs.example.test/guide'],
      );
    }, '23514');
    await rejected(async (client, { a }) => {
      const article = randomUUID();
      for (let i = 0; i < 2; i++) {
        await client.query(
          'INSERT INTO core.knowledge_articles (id,workspace_id,version,title,body,author_subject,source_ref) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [article, a, 1, 'Guide', 'Body', 'alice', 'https://docs.example.test/guide'],
        );
      }
    }, '23505');
    await rejected(async (client, { a }) => {
      await client.query(
        'INSERT INTO core.knowledge_articles (id,workspace_id,version,title,body,author_subject,source_ref) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), a, 1, 'Guide', 'Body', 'alice', ''],
      );
    }, '23514');
  });

  await t.test('audit cannot be updated, deleted or truncated through normal SQL', async () => {
    for (const statement of [
      'UPDATE core.audit_events SET action=action',
      'DELETE FROM core.audit_events',
      'TRUNCATE core.audit_events',
    ]) {
      await rejected(async (client, { a }) => {
        await client.query(
          'INSERT INTO core.audit_events (id,workspace_id,actor_subject,action,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [randomUUID(), a, 'alice', 'workspace.created', 'workspace', a],
        );
        await client.query(statement);
      }, '55000');
    }
  });

  await t.test(
    'audit constraint failure rolls back preceding business write on real DB',
    async () => {
      const id = randomUUID();
      await assert.rejects(
        withTransaction(pool, async (client) => {
          await client.query('INSERT INTO core.workspaces (id,name) VALUES ($1,$2)', [
            id,
            'Must rollback',
          ]);
          await client.query(
            'INSERT INTO core.audit_events (id,workspace_id,actor_subject,action,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6)',
            [randomUUID(), id, 'alice', '', 'workspace', id],
          );
        }),
        { code: '23514' },
      );
      assert.equal(
        (await pool.query('SELECT id FROM core.workspaces WHERE id=$1', [id])).rowCount,
        0,
      );
    },
  );
});
