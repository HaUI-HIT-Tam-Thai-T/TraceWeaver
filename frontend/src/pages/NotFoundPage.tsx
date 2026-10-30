import { Button } from "../components/ui/primitives/button";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <>
      <h1 className="type-h1 mb-6">Không tìm thấy trang</h1>
      <p className="type-body-sm text-muted">Đường dẫn có thể đã thay đổi. Về Tổng quan để tiếp tục với workspace hiện tại.</p><Button asChild><Link to="/dashboard">Về Tổng quan</Link></Button>
    </>
  );
}
