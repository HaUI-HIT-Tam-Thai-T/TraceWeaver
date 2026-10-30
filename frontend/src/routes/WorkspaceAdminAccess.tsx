import { Outlet } from 'react-router-dom';
import { useWorkspace } from '../features/workspace/hooks/useWorkspace';
import { PageHeading } from '../components/layout/PageHeading';
export function WorkspaceAdminAccess() {
  const { permissions } = useWorkspace();
  if (!permissions.canAdmin) return <section className="space-y-4"><PageHeading title="Không có quyền quản trị workspace" /><p>Chức năng này yêu cầu vai trò quản trị viên của workspace đang chọn.</p></section>;
  return <Outlet />;
}
