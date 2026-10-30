// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const scenarioKinds = ['success', 'capacity_failure', 'image_failure', 'network_failure',
  'partial_id', 'missing_provision', 'retry', 'late_log', 'duplicate_delivery',
  'conflicting_delivery', 'ambiguous', 'missing_ids'];
const labels = ['Cấp môi trường thành công', 'Hết RAM trên cụm lab', 'Không tải được image',
  'Không cấp được địa chỉ mạng', 'Log cấp máy thiếu mã yêu cầu', 'Chưa nhận log cấp môi trường',
  'Cấp lại thành công sau lỗi mạng', 'Log tài khoản gửi đến muộn', 'Collector gửi lại cùng bản ghi',
  'Collector gửi nội dung khác cho cùng ID', 'Hai tài khoản cùng nhận một mã yêu cầu', 'Log thiếu mã liên kết'];
const courses = [
  { name: 'Lập trình Python', class: 'CNTT-K18-PY01', image: 'python-3.12-lab', cpu: 2, ram: 4 },
  { name: 'Cơ sở dữ liệu', class: 'CNTT-K18-CSDL02', image: 'postgres-17-lab', cpu: 2, ram: 4 },
  { name: 'Quản trị Linux', class: 'CNTT-K17-LNX01', image: 'ubuntu-24.04-lab', cpu: 2, ram: 2 },
  { name: 'Lập trình Web', class: 'CNTT-K18-WEB03', image: 'node-24-lab', cpu: 4, ram: 8 },
];
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);

export function generateDataset({ seed = 'traceweaver-realistic-v3', baseTime = '2026-10-29T01:00:00.000Z', count = 36 } = {}) {
  assert.ok(typeof seed === 'string' && seed.length > 0 && seed.length <= 200, 'Seed must contain 1–200 characters');
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 10000, 'Journey count must be 1–10000');
  const base = Date.parse(baseTime);
  assert.ok(Number.isFinite(base) && /Z$/.test(baseTime), 'Explicit UTC baseTime is required');
  const day = new Date(base).toISOString().slice(0, 10).replaceAll('-', '');
  const key = hash(seed).slice(0, 4).toUpperCase();
  const dataset = `LAB-SIM-${day}-${key}`;
  const events = [], deliveries = [], delayed = [], scenarios = [], expected_edges = [];
  for (let index = 0; index < count; index++) {
    const kindIndex = index % scenarioKinds.length, kind = scenarioKinds[kindIndex];
    const number = String(index + 1).padStart(3, '0');
    const request = `SIM-${day.slice(2)}-${key}-${number}`;
    const course = courses[(index + parseInt(hash(seed + index).slice(0, 2), 16)) % courses.length];
    const account = `svlab${18001 + index}`, student = `SV-MP-${18001 + index}`;
    const job = `JOB-${key}-${number}`, machine = `lab-${course.image.split('-')[0]}-${number}`;
    const start = base + index * 12 * 60000;
    const jitter = parseInt(hash(`${seed}:${index}`).slice(0, 4), 16) % 12000;
    const accountAt = 6000 + jitter, provisionAt = 55000 + jitter * 3;
    const time = offset => new Date(start + offset).toISOString();
    const refs = (...pairs) => pairs.map(([namespace, value]) => ({ namespace, value }));
    const requestRef = ['request', request], accountRef = ['account', account], jobRef = ['job', job];
    const scenarioEvents = [];
    function event(step, service, action, offset, message, identifiers, payload = {}, outcome = 'success') {
      const item = { source_event_id: `${dataset}-${number}-${step}`, occurred_at: time(offset), service,
        action, outcome, identifiers, message: `${message} [Mô phỏng]`,
        payload: { demo: true, dataset, class_code: course.class, ...payload } };
      scenarioEvents.push(item); events.push(item); return item;
    }
    const intake = event('0', 'intake', 'request.accepted', 0,
      `${request} — Tiếp nhận yêu cầu của ${student}, học phần ${course.name}, lớp ${course.class}; cấu hình ${course.cpu} vCPU, ${course.ram} GiB RAM, thời hạn 120 phút.`,
      refs(requestRef), { student_code: student, course: course.name, requested_cpu: course.cpu,
        requested_ram_gb: course.ram, duration_minutes: 120, lab_pool: 'lab-pool-02' });
    const linked = kind !== 'missing_ids';
    const created = event('1', 'account', 'account.created', accountAt,
      `${linked ? request + ' — ' : ''}Đã tạo tài khoản ${account}, thêm vào nhóm ${course.class}; thời hạn sử dụng đến hết buổi thực hành.`,
      linked ? refs(requestRef, accountRef) : [], { account, group: course.class, attempt: 1 });
    let provision;
    if (kind !== 'missing_provision') {
      const failed = ['capacity_failure', 'image_failure', 'network_failure', 'retry'].includes(kind);
      const error = kind === 'capacity_failure' ? ['CAPACITY_EXHAUSTED', `Cụm lab-pool-02 còn 1 GiB RAM, cần ${course.ram} GiB; yêu cầu đang chờ giải phóng tài nguyên.`]
        : kind === 'image_failure' ? ['IMAGE_PULL_TIMEOUT', `Quá 90 giây khi tải image ${course.image} từ registry lab; chưa tạo máy.`]
          : ['NETWORK_ALLOCATION_FAILED', 'DHCP của lab-net-03 chưa cấp được địa chỉ; chưa có môi trường sẵn sàng.'];
      provision = event('2', 'provision', failed ? 'provision.failed' : 'provision.completed', provisionAt,
        `${linked ? request + ' — ' : ''}${failed ? `Tác vụ ${job} thất bại: ${error[1]}` : `Tác vụ ${job} đã cấp máy ${machine}, image ${course.image}, ${course.cpu} vCPU / ${course.ram} GiB RAM; địa chỉ 10.42.${index % 250}.10, healthcheck đạt.`}`,
        !linked ? [] : kind === 'partial_id' ? refs(accountRef, jobRef) : refs(requestRef, accountRef, jobRef),
        { account, job_id: job, image: course.image, cpu: course.cpu, ram_gb: course.ram, attempt: 1,
          ...(failed ? { error_code: error[0], retryable: kind !== 'capacity_failure' }
            : { machine, elapsed_ms: provisionAt - accountAt, healthcheck: 'passed' }) }, failed ? 'failed' : 'success');
    }
    if (kind === 'retry') event('3', 'provision', 'provision.completed', provisionAt + 90000,
      `${request} — Thử lại tác vụ ${job} lần 2 sau khi DHCP phục hồi; máy ${machine} đã có địa chỉ và healthcheck đạt.`,
      refs(requestRef, accountRef, jobRef), { account, job_id: job, image: course.image, cpu: course.cpu,
        ram_gb: course.ram, attempt: 2, machine, healthcheck: 'passed' });
    if (kind === 'ambiguous') event('3', 'account', 'account.created', accountAt + 2000,
      `${request} — Worker dự phòng tạo tài khoản ${account}b cho cùng yêu cầu; cần đối chiếu người dùng trước khi chọn tài khoản.`,
      refs(requestRef, ['account', account + 'b']), { account: account + 'b', group: course.class, attempt: 1 });
    for (const item of scenarioEvents) {
      const delivery = { event: clone(item), expected_status: 'accepted' };
      if (kind === 'late_log' && item === created) delayed.push(delivery);
      else deliveries.push(delivery);
    }
    if (kind === 'duplicate_delivery') deliveries.push({ event: clone(created), expected_status: 'duplicate' });
    if (kind === 'conflicting_delivery') deliveries.push({ event: { ...clone(created),
      message: created.message.replace('Đã tạo tài khoản', 'Collector hiệu chỉnh: đã tạo tài khoản') },
      expected_status: 'rejected', expected_code: 'SOURCE_EVENT_CONFLICT' });
    // Hidden causal truth stays outside observable records and API payloads.
    expected_edges.push({ from: intake.source_event_id, to: created.source_event_id });
    if (provision) expected_edges.push({ from: created.source_event_id, to: provision.source_event_id });
    if (kind === 'retry') expected_edges.push({ from: created.source_event_id, to: scenarioEvents[3].source_event_id });
    scenarios.push({ index: index + 1, kind, label: labels[kindIndex], request_code: request,
      title: `${request} · ${course.name} · ${labels[kindIndex]}`,
      root_source_event_id: intake.source_event_id, event_ids: scenarioEvents.map(e => e.source_event_id),
      window: { from: time(-1000), to: time(5 * 60000) },
      expected_rule_links: ['ambiguous', 'missing_ids'].includes(kind) ? 0 : kind === 'missing_provision' ? 1 : kind === 'retry' ? 3 : 2,
      expect_ai: !['ambiguous', 'missing_ids'].includes(kind) });
  }
  deliveries.push(...delayed);
  return { manifest: { version: 1, dataset, seed, base_time: new Date(base).toISOString(),
    journeys: count, unique_events: events.length, delivery_attempts: deliveries.length,
    duplicates: deliveries.filter(d => d.expected_status === 'duplicate').length,
    expected_conflicts: deliveries.filter(d => d.expected_status === 'rejected').length },
  events, deliveries, scenarios, oracle: { dataset, expected_edges } };
}
