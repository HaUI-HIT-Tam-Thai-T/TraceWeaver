// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readConfig } from '../src/config.js';
import { createDatabase } from '../src/core/data/database.js';
import { seedFrontendDemo } from './seed-frontend-demo.js';

export const labDemoTag = 'LAB-DEMO-20261028-v2';
const courses = [
  { name: 'Lập trình Python', class: 'CNTT-K18-PY01', image: 'python-3.12-lab', cpu: 2, ram: 4 },
  { name: 'Cơ sở dữ liệu', class: 'CNTT-K18-CSDL02', image: 'postgres-17-lab', cpu: 2, ram: 4 },
  { name: 'Quản trị Linux', class: 'CNTT-K17-LNX01', image: 'ubuntu-24.04-lab', cpu: 2, ram: 2 },
  { name: 'Lập trình Web', class: 'CNTT-K18-WEB03', image: 'node-24-lab', cpu: 4, ram: 8 },
];
const failures = [
  { code: 'CAPACITY_EXHAUSTED', text: 'Cụm lab-pool-02 không còn đủ RAM; chưa tạo máy thực hành.' },
  { code: 'IMAGE_PULL_TIMEOUT', text: 'Quá 90 giây khi tải image từ registry nội bộ; chưa khởi tạo được máy.' },
  { code: 'NETWORK_ALLOCATION_FAILED', text: 'Không cấp được địa chỉ trong mạng lab-net-03; máy chưa sẵn sàng.' },
];
const states = ['new', 'assigned', 'investigating', 'awaiting_verification'];

export function labDemo(baseTime) {
  const base = new Date(baseTime).getTime();
  assert.ok(Number.isFinite(base), 'Invalid demo start time');
  return Array.from({ length: 12 }, (_, index) => {
    const kind = index % 4, number = String(index + 1).padStart(2, '0');
    const course = courses[(index + Math.floor(index / 4)) % courses.length];
    const request = `LAB-20261028-${String(index + 1).padStart(3, '0')}`;
    const student = `SV-DEMO-${18001 + index}`, account = `svdemo${18001 + index}`;
    const machine = `lab-${course.image.split('-')[0]}-${number}`, job = `JOB-2810-${number}`;
    const start = base + index * 10 * 60000, failure = failures[Math.floor(index / 4)];
    const actions = ['request.accepted', 'account.created', kind === 1 ? 'provision.failed' : 'provision.completed'];
    const times = [0, 7000 + index * 700, kind === 1 ? 115000 : 68000 + index * 2300];
    const messages = [
      `${request} — Đã tiếp nhận yêu cầu của ${student}, lớp ${course.class}, học phần ${course.name}; cấu hình ${course.cpu} vCPU / ${course.ram} GB RAM. [Demo]`,
      `${kind === 3 ? 'Yêu cầu không có mã tương quan' : request} — Đã tạo tài khoản ${account} và thêm vào nhóm ${course.class}. [Demo]`,
      kind === 1
        ? `${request} — Cấp máy thất bại (${job}): ${failure.text} [Demo]`
        : `${kind === 3 ? 'Tác vụ không có mã tương quan' : request} — Máy ${machine} đã sẵn sàng sau ${Math.round(times[2] / 1000)} giây; image ${course.image}, ${course.cpu} vCPU / ${course.ram} GB RAM. [Demo]`,
    ];
    const events = ['intake', 'account', 'provision'].slice(0, kind === 2 ? 2 : 3).map((service, step) => ({
      source_event_id: `${labDemoTag}-${number}-${step}`,
      occurred_at: new Date(start + times[step]).toISOString(), service, action: actions[step],
      outcome: kind === 1 && step === 2 ? 'failed' : 'success',
      identifiers: kind === 3 && step > 0 ? [] : [
        { namespace: 'request', value: request },
        ...(step > 0 ? [{ namespace: 'account', value: account }] : []),
        ...(step === 2 ? [{ namespace: 'job', value: job }] : []),
      ],
      message: messages[step],
      payload: { demo: true, dataset: labDemoTag, class_code: course.class,
        ...(step === 0 ? { student_code: student, course: course.name, requested_cpu: course.cpu, requested_ram_gb: course.ram } : {}),
        ...(step === 1 ? { account, group: course.class, attempt: 1 } : {}),
        ...(step === 2 ? { image: course.image, cpu: course.cpu, ram_gb: course.ram,
          ...(kind === 1 ? { error_code: failure.code, retryable: true } : { machine, elapsed_ms: times[step] }) } : {}),
      },
    }));
    if (kind === 3) events.push({ ...events[1], source_event_id: `${labDemoTag}-${number}-retry`,
      occurred_at: new Date(start + 35000 + index * 1000).toISOString(),
      message: `Nhận lại lệnh tạo tài khoản ${account} (lần 2); tài khoản đã tồn tại, giữ nguyên nhóm ${course.class}. Bản tin thiếu mã tương quan. [Demo]`,
      payload: { ...events[1].payload, attempt: 2, reused_existing: true } });
    const issue = ['Cấp máy thực hành hoàn tất', failure.text.split(';')[0], 'Đã có tài khoản, chưa thấy log cấp máy', 'Cần đối chiếu bản tin thiếu mã tương quan'][kind];
    return { title: `[Demo] ${request} · ${course.name} · ${issue}`, state: states[Math.floor(index / 3)],
      mode: index % 3 === 0 ? 'hybrid' : 'rule_only', events,
      evidenceNote: `Dữ liệu mô phỏng: đính kèm ${events.length} bản ghi quan sát để đối chiếu yêu cầu ${request}; kết quả từng bước xem trong log.`,
      transitionReasons: { assign: 'Phân công trực ca kiểm tra yêu cầu cấp môi trường thực hành. [Demo]',
        start: 'Bắt đầu đối chiếu log tiếp nhận, tài khoản và cấp máy theo mã yêu cầu. [Demo]',
        request_verification: 'Đã đính kèm log quan sát; chuyển người xác minh kiểm tra kết quả và phần còn thiếu. [Demo]' },
      window: { from: new Date(start).toISOString(), to: new Date(start + 4 * 60000).toISOString() } };
  });
}

async function main() {
  const args = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf('='); return at < 0 ? [arg, true] : [arg.slice(0, at), arg.slice(at + 1)]; }));
  if (!args.has('--apply')) {
    console.log(JSON.stringify({ dry_run: true, dataset: labDemoTag, events: 36, runs: 12, cases: 12,
      sample: labDemo('2026-10-28T01:00:00Z')[0],
      usage: 'node --env-file-if-exists=.env backend/scripts/seed-lab-demo.js --apply --workspace=UUID --operator=SUBJECT --ingest=SUBJECT' }, null, 2));
    return;
  }
  let pool;
  try {
    const workspace = args.get('--workspace'), operator = args.get('--operator'), ingest = args.get('--ingest');
    assert.ok([workspace, operator, ingest].every((value) => typeof value === 'string'), 'Explicit target required');
    pool = createDatabase(readConfig());
    console.log(JSON.stringify(await seedFrontendDemo(pool, { workspace, operator, ingest, dataset: labDemoTag, generate: labDemo }), null, 2));
  } catch (error) { console.error(`LAB_DEMO_SEED_FAILED: ${error.code ?? error.name}; transaction rolled back, secrets withheld`); process.exitCode = 1; }
  finally { if (pool) await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
