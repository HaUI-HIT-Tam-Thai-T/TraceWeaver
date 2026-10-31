// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readConfig } from '../src/config.js';
import { createDatabase, withTransaction } from '../src/core/data/database.js';
import { createIngestionRepository } from '../src/core/data/ingestion-repository.js';
import { createIngestionService } from '../src/services/ingestion.service.js';
import { createRunRepository } from '../src/core/data/run-repository.js';
import { createCaseRepository } from '../src/core/data/case-repository.js';
import { createDashboardRepository } from '../src/core/data/dashboard-repository.js';
import { caseInput } from '../src/validations/case.validation.js';

export const demoTag = 'FE-DEMO-20261027-v1';
const services = ['intake', 'account', 'provision'];
const states = ['new', 'assigned', 'investigating', 'awaiting_verification'];

export function frontendDemo(baseTime) {
  const base = new Date(baseTime).getTime();
  assert.ok(Number.isFinite(base), 'Invalid demo start time');
  return Array.from({ length: 12 }, (_, index) => {
    const kind = index % 4,
      number = String(index + 1).padStart(2, '0');
    const start = base + index * 10 * 60000;
    const label = [
      'Cap moi truong thanh cong',
      'Cap moi truong that bai',
      'Thieu log provision',
      'Thieu dinh danh va retry',
    ][kind];
    const actions = [
      'request.accepted',
      'account.created',
      kind === 1 ? 'provision.failed' : 'provision.completed',
    ];
    const events = services.slice(0, kind === 2 ? 2 : 3).map((service, step) => ({
      source_event_id: `${demoTag}-${number}-${step}`,
      occurred_at: new Date(start + step * 20000).toISOString(),
      service,
      action: actions[step],
      outcome: kind === 1 && step === 2 ? 'failed' : 'success',
      identifiers:
        kind === 3 && step > 0 ? [] : [{ namespace: 'request', value: `${demoTag}-REQ-${number}` }],
      message: `[FE-DEMO] ${number}: ${label} / ${actions[step]}`,
      payload: {
        demo: true,
        dataset: demoTag,
        lab: `DX-LAB-${number}`,
        attempt: 1,
        ...(kind === 1 && step === 2 ? { error_code: 'CAPACITY_EXHAUSTED' } : {}),
      },
    }));
    if (kind === 3)
      events.push({
        ...events[1],
        source_event_id: `${demoTag}-${number}-retry`,
        occurred_at: new Date(start + 30000).toISOString(),
        message: `[FE-DEMO] ${number}: account retry, missing correlation ID`,
        payload: { ...events[1].payload, attempt: 2 },
      });
    return {
      title: `[${demoTag}] ${number} - ${label}`,
      state: states[Math.floor(index / 3)],
      mode: index % 3 === 0 ? 'hybrid' : 'rule_only',
      events,
      window: { from: new Date(start).toISOString(), to: new Date(start + 60000).toISOString() },
    };
  });
}

export async function seedFrontendDemo(
  pool,
  { workspace, operator, ingest, dataset = demoTag, generate = frontendDemo },
) {
  assert.ok(
    workspace && operator && ingest && operator !== ingest,
    'Explicit workspace/operator/ingest required',
  );
  assert.match(dataset, /^[A-Z0-9-]+$/i, 'Explicit safe dataset tag required');
  // One outer transaction keeps partial fixtures out of the deployed workspace.
  return withTransaction(pool, async (connection) => {
    await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${dataset}:${workspace}`,
    ]);
    let sequence = 0;
    const transactional = {
      query: connection.query.bind(connection),
      async connect() {
        const savepoint = `frontend_demo_${++sequence}`;
        return {
          release() {},
          async query(sql, values) {
            if (sql === 'BEGIN') return connection.query(`SAVEPOINT ${savepoint}`);
            if (sql === 'COMMIT') return connection.query(`RELEASE SAVEPOINT ${savepoint}`);
            if (sql === 'ROLLBACK') return connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            return connection.query(sql, values);
          },
        };
      },
    };
    const { rows: sources } = await connection.query(
      `SELECT id,service FROM core.sources
      WHERE workspace_id=$1 AND service=ANY($2::text[]) AND parser_version=service||'-v1' ORDER BY id`,
      [workspace, services],
    );
    assert.equal(sources.length, 3, 'Expected exactly three supported demo sources');
    assert.equal(
      new Set(sources.map((source) => source.service)).size,
      3,
      'Expected one source per service',
    );
    const sourceIds = sources.map((source) => source.id);
    const sourceId = (service) => sources.find((source) => source.service === service).id;
    const { rows: existing } = await connection.query(
      `SELECT source_event_id,event_id,occurred_at FROM core.events
      WHERE workspace_id=$1 AND source_event_id LIKE $2 ORDER BY occurred_at`,
      [workspace, `${dataset}-%`],
    );
    const first = existing.find((event) => event.source_event_id === `${dataset}-01-0`);
    const base = first?.occurred_at ?? new Date(Date.now() - 120 * 60000);
    const scenarios = generate(base),
      events = new Map(existing.map((event) => [event.source_event_id, event.event_id]));
    assert.ok(
      scenarios.length > 0 &&
        scenarios.every((scenario) =>
          scenario.events.every((event) => event.source_event_id.startsWith(`${dataset}-`)),
        ),
      'Dataset must own every generated event',
    );
    const ingestion = createIngestionService(createIngestionRepository(transactional));
    const runs = createRunRepository(transactional),
      cases = createCaseRepository(transactional);
    // Repository authorization checks current memberships/roles/grants; no ACL writes.
    const before = await createDashboardRepository(transactional).get(operator, workspace, {});
    let inserted = 0,
      newRuns = 0,
      newCases = 0;
    for (const service of services) {
      const pending = scenarios
        .flatMap((scenario) => scenario.events)
        .filter((event) => event.service === service && !events.has(event.source_event_id));
      if (!pending.length) continue;
      const result = await ingestion.batch(ingest, workspace, sourceId(service), {
        events: pending,
      });
      assert.equal(result.rejected, 0, 'Demo events must pass ingestion validation');
      result.results.forEach((entry, index) =>
        events.set(pending[index].source_event_id, entry.event_id),
      );
      inserted += result.accepted;
    }
    const manifest = [];
    for (const scenario of scenarios) {
      const root = events.get(scenario.events[0].source_event_id);
      const {
        rows: [savedRun],
      } = await connection.query(
        `SELECT document FROM core.reconstruction_runs
        WHERE workspace_id=$1 AND root_event_id=$2 AND creator_subject=$3 AND request->>'mode'=$4 ORDER BY id LIMIT 1`,
        [workspace, root, operator, scenario.mode],
      );
      const run =
        savedRun?.document ??
        (await runs.create(operator, workspace, {
          root_event_id: root,
          source_ids: sourceIds,
          mode: scenario.mode,
          window: scenario.window,
        }));
      if (!savedRun) newRuns++;
      const {
        rows: [savedCase],
      } = await connection.query(
        'SELECT id FROM core.cases WHERE workspace_id=$1 AND run_id=$2 AND title=$3',
        [workspace, run.id, scenario.title],
      );
      let item;
      if (savedCase) item = (await cases.get(operator, workspace, savedCase.id)).case;
      else {
        item = await cases.create(
          operator,
          workspace,
          caseInput('CaseCreate', { run_id: run.id, title: scenario.title }),
        );
        newCases++;
        for (const action of ['assign', 'start', 'request_verification'].slice(
          0,
          states.indexOf(scenario.state),
        )) {
          if (action === 'request_verification')
            await cases.evidence(
              operator,
              workspace,
              item.id,
              caseInput('EvidenceCreate', {
                kind: 'events',
                event_ids: scenario.events.map((event) => events.get(event.source_event_id)),
                note:
                  scenario.evidenceNote ?? '[FE-DEMO] Synthetic logs for frontend verification.',
              }),
            );
          item = await cases.transition(
            operator,
            workspace,
            item.id,
            caseInput('CaseTransition', {
              action,
              expected_version: item.version,
              reason:
                scenario.transitionReasons?.[action] ?? '[FE-DEMO] Prepare test workflow state',
              ...(action === 'assign' ? { owner_id: operator } : {}),
            }),
          );
        }
      }
      const graph = await runs.get(operator, workspace, run.id, true);
      manifest.push({
        title: scenario.title,
        case_id: item.id,
        state: item.state,
        run_id: run.id,
        root_event_id: root,
        mode: run.mode,
        links: graph.links.length,
        unresolved: graph.unresolved_event_ids.length,
        window: scenario.window,
      });
    }
    const after = await createDashboardRepository(transactional).get(operator, workspace, {});
    return {
      dataset,
      workspace_id: workspace,
      inserted_events: inserted,
      inserted_runs: newRuns,
      inserted_cases: newCases,
      total_demo_events: events.size,
      before,
      after,
      scenarios: manifest,
    };
  });
}

async function main() {
  const args = new Map(
    process.argv.slice(2).map((arg) => {
      const at = arg.indexOf('=');
      return at < 0 ? [arg, true] : [arg.slice(0, at), arg.slice(at + 1)];
    }),
  );
  if (!args.has('--apply')) {
    console.log(
      JSON.stringify(
        {
          dry_run: true,
          dataset: demoTag,
          events: 36,
          runs: 12,
          cases: 12,
          states,
          usage:
            'node --env-file-if-exists=.env backend/scripts/seed-frontend-demo.js --apply --workspace=UUID --operator=SUBJECT --ingest=SUBJECT',
        },
        null,
        2,
      ),
    );
    return;
  }
  let pool;
  try {
    const workspace = args.get('--workspace'),
      operator = args.get('--operator'),
      ingest = args.get('--ingest');
    assert.ok(
      typeof workspace === 'string' && typeof operator === 'string' && typeof ingest === 'string',
      'Explicit target required',
    );
    pool = createDatabase(readConfig());
    console.log(
      JSON.stringify(await seedFrontendDemo(pool, { workspace, operator, ingest }), null, 2),
    );
  } catch (error) {
    console.error(
      `FRONTEND_DEMO_SEED_FAILED: ${error.code ?? error.name}; transaction rolled back, secrets withheld`,
    );
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

if (
  !process.argv[1] ||
  process.argv[1] === '-' ||
  import.meta.url === pathToFileURL(process.argv[1]).href
)
  await main();
