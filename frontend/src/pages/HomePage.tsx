import { AuthStatus } from '../features/auth/components/AuthStatus';
import { WorkspacePanel } from '../features/workspace/components/WorkspacePanel';
import { Link } from 'react-router-dom';

const destinations = [
  { to: '/dashboard', title: 'Tổng quan', description: 'Theo dõi chỉ số và các case cần xử lý.', label: 'Mở dashboard' },
  { to: '/events', title: 'Sự kiện', description: 'Tra cứu sự kiện và tái dựng chuỗi liên kết.', label: 'Mở Event explorer' },
  { to: '/cases', title: 'Cases', description: 'Theo dõi điều tra, bằng chứng và xác minh.', label: 'Mở danh sách cases' },
  { to: '/knowledge', title: 'Tri thức', description: 'Tra cứu kiến thức, phiên bản và nguồn tham chiếu.', label: 'Tra cứu knowledge' },
];

export function HomePage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-line pb-6">
        <p className="type-label mb-2 tracking-widest text-focus">ĐIỀU TRA &amp; TRUY VẾT</p>
        <h1 className="type-h1">TraceWeaver</h1>
        <p className="type-body mt-3 max-w-2xl text-muted">Kết nối sự kiện, tái dựng diễn biến và quản lý bằng chứng trong workspace của bạn.</p>
      </div>
      <nav aria-label="Chức năng" className="grid gap-4 sm:grid-cols-2">
        {destinations.map((item) => (
          <Link key={item.to} to={item.to} className="ui-panel group block hover:border-focus">
            <h2 className="type-h3 text-foreground">{item.title}</h2>
            <p className="type-body-sm mt-2 text-muted">{item.description}</p>
            <span className="type-label mt-4 inline-block group-hover:underline">{item.label} →</span>
          </Link>
        ))}
      </nav>
      <AuthStatus />
      <WorkspacePanel />
    </div>
  );
}
