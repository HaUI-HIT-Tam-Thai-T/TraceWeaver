// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readConfig } from '../src/config.js';
import { createDatabase, withTransaction } from '../src/core/data/database.js';
import { workspaceId } from '../src/validations/access.validation.js';

export const sourceNames = { intake: 'Tiếp nhận yêu cầu', account: 'Quản lý tài khoản', provision: 'Cấp phát môi trường' };
export const articles = [
  { id: '60000000-0000-4000-8000-000000000001', title: 'Đọc hành trình cấp môi trường',
    body: 'Luồng thông thường gồm request.accepted (tiếp nhận yêu cầu), account.created (tạo tài khoản) và provision.completed (cấp phát môi trường). Outcome là kết quả quan sát của từng sự kiện, không phải kết luận cho toàn hành trình. Đối chiếu thời gian, mã yêu cầu và bằng chứng liên kết trước khi kết luận.', source_ref: 'repo:backend/RECONSTRUCTION.md' },
  { id: '60000000-0000-4000-8000-000000000002', title: 'Xử lý liên kết chưa xác định',
    body: 'Unresolved nghĩa là chưa đủ căn cứ nối sự kiện vào hành trình. Kiểm tra mã yêu cầu, tài khoản, khoảng thời gian và nguồn log. Thiếu log không chứng minh dịch vụ thất bại; nhiều ứng viên không chứng minh ứng viên gần nhất là đúng. Chỉ tạo liên kết thủ công khi có bằng chứng; ghi rõ lý do khi duyệt hoặc từ chối.', source_ref: 'repo:backend/RECONSTRUCTION.md' },
  { id: '60000000-0000-4000-8000-000000000003', title: 'Giao và xác minh hồ sơ',
    body: 'Người nhận cần role operator hoặc reviewer và quyền đọc toàn bộ nguồn của run. Hồ sơ đi qua new, assigned, investigating, awaiting_verification, closed. Thêm bằng chứng và ghi chú trước khi yêu cầu xác minh. Reviewer xác minh và xử lý liên kết pending trước khi đóng; mở lại hồ sơ trước khi sửa căn cứ. Quyền và version được BE kiểm tra ở mỗi thao tác.', source_ref: 'repo:backend/CASES.md' },
  { id: '60000000-0000-4000-8000-000000000004', title: 'Đọc kết quả AI và bằng chứng',
    body: 'Điểm AI là tín hiệu hỗ trợ duyệt liên kết, không phải xác nhận quan hệ nhân quả. Kiểm tra method, degraded, model_version và bằng chứng. Khi AI không khả dụng, hệ thống có thể dùng rule fallback và báo degraded. Dữ liệu demo là tổng hợp; không dùng điểm demo để khẳng định độ chính xác thực tế.', source_ref: 'repo:backend/SCORER.md' },
];

export async function seedReadableDemo(pool, workspace) {
  workspaceId(workspace);
  return withTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`readable-demo-v1:${workspace}`]);
    const { rowCount } = await client.query('SELECT id FROM core.workspaces WHERE id=$1', [workspace]);
    assert.equal(rowCount, 1, 'Workspace not found');
    let inserted = 0, renamed = 0;
    for (const article of articles) {
      const result = await client.query(`INSERT INTO core.knowledge_articles(id,workspace_id,version,title,body,author_subject,source_ref)
        VALUES($1,$2,1,$3,$4,'readable-demo-seed',$5) ON CONFLICT DO NOTHING`,
      [article.id, workspace, article.title, article.body, article.source_ref]);
      inserted += result.rowCount;
    }
    for (const [service, name] of Object.entries(sourceNames)) {
      // Only replace technical default labels. Preserve custom operator names.
      const result = await client.query(`UPDATE core.sources SET name=$3
        WHERE workspace_id=$1 AND service=$2 AND source_key=$2 AND name=$2`, [workspace, service, name]);
      renamed += result.rowCount;
    }
    return { workspace_id: workspace, inserted_articles: inserted, renamed_sources: renamed };
  });
}

async function main() {
  const args = process.argv.slice(2), workspace = args.find((arg) => arg.startsWith('--workspace='))?.slice(12);
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ dry_run: true, articles, source_names: sourceNames,
      usage: 'node --env-file-if-exists=.env backend/scripts/seed-readable-demo.js --apply --workspace=UUID' }, null, 2));
    return;
  }
  workspaceId(workspace);
  const pool = createDatabase(readConfig());
  try { console.log(JSON.stringify(await seedReadableDemo(pool, workspace))); }
  finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); }
  catch (error) { console.error(`READABLE_DEMO_SEED_FAILED: ${error.code ?? error.name}`); process.exitCode = 1; }
}
