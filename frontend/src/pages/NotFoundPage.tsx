import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <>
      <h1 className="type-h1 mb-6">Không tìm thấy trang</h1>
      <Link to="/dashboard">Về Tổng quan</Link>
    </>
  );
}
