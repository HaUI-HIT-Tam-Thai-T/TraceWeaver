import { z } from 'zod';
import { roleSchema } from '../workspace/schemas.ts';

export const adminRoleSchema = z.enum(['viewer', 'operator', 'reviewer', 'admin']);
export const adminRolesSchema = z.array(adminRoleSchema).min(1).max(4).refine(roles => new Set(roles).size === roles.length, 'Vai trò không được trùng.');
export const subjectSchema = z.string().min(1).max(255).refine(value => /\S/.test(value) && !value.includes('\0') && !/[\uD800-\uDFFF]/u.test(value), 'Mã tài khoản không hợp lệ.');
export const versionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const addMemberSchema = z.strictObject({ subject: subjectSchema, roles: adminRolesSchema, expected_version: versionSchema });
export const updateMemberSchema = z.strictObject({ roles: adminRolesSchema, active: z.boolean(), expected_version: versionSchema });
export const sourceGrantSchema = z.strictObject({ enabled: z.boolean(), expected_version: versionSchema });
export const accountFormSchema = z.strictObject({
  username: z.string().regex(/^(?!service-account-)[a-z0-9][a-z0-9._-]{2,63}$/, 'Tên đăng nhập gồm 3–64 ký tự chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang; không dùng tiền tố service-account-.'),
  temporary_password: z.string().min(12, 'Mật khẩu tạm ít nhất 12 ký tự.').max(128).refine(value => !value.includes('\0') && !/[\uD800-\uDFFF]/u.test(value), 'Mật khẩu không hợp lệ.'),
  roles: adminRolesSchema,
});
export const accountCreateSchema = accountFormSchema.extend({ expected_version: versionSchema });
export const memberSchema = z.strictObject({ subject: subjectSchema, active: z.boolean(), roles: z.array(roleSchema).refine(roles => new Set(roles).size === roles.length), direct_source_ids: z.array(z.uuid()).refine(ids => new Set(ids).size === ids.length) });
export const membersPageSchema = z.strictObject({ workspace_id: z.uuid(), version: versionSchema, items: z.array(memberSchema), next_after: subjectSchema.nullable() }).refine(page => new Set(page.items.map(item => item.subject)).size === page.items.length);
export const memberResultSchema = z.strictObject({ subject: subjectSchema, active: z.boolean(), roles: adminRolesSchema, version: versionSchema });
// BE member PUT echoes expected_version; add-member POST does not.
export const updateResultSchema = memberResultSchema.extend({ expected_version: versionSchema });
export const grantResultSchema = z.strictObject({ subject: subjectSchema, source_id: z.uuid(), enabled: z.boolean(), version: versionSchema });
export const completedSchema = z.strictObject({ state: z.literal('completed'), subject: subjectSchema, username: accountFormSchema.shape.username, roles: adminRolesSchema, active: z.literal(true), version: versionSchema });
export const operationSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('pending'), username: accountFormSchema.shape.username, current_version: versionSchema }),
  completedSchema.extend({ current_version: versionSchema }),
]);
export type Member = z.infer<typeof memberSchema>;
export type MembersPage = z.infer<typeof membersPageSchema>;
export type AddMember = z.infer<typeof addMemberSchema>;
export type UpdateMember = z.infer<typeof updateMemberSchema>;
export type SourceGrant = z.infer<typeof sourceGrantSchema>;
export type AccountForm = z.infer<typeof accountFormSchema>;
export type AccountCreate = z.infer<typeof accountCreateSchema>;
export type Completed = z.infer<typeof completedSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
