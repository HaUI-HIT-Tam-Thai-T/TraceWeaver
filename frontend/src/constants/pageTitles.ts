const PAGE_TITLES: { [path: string]: string | undefined } = {
  '/': 'Tổng quan', '/dashboard': 'Tổng quan', '/events': 'Sự kiện',
  '/cases': 'Hồ sơ', '/knowledge': 'Tri thức', '/auth/callback': 'Đăng nhập',
};

// Only the route name is public metadata: never include query strings or API data.
export function getPageTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  const name = Object.hasOwn(PAGE_TITLES, path) ? PAGE_TITLES[path] : undefined;
  return `${name ?? (/^\/events\/[^/]+$/.test(path) ? 'Chi tiết sự kiện' : /^\/cases\/[^/]+$/.test(path) ? 'Chi tiết hồ sơ' : 'Không tìm thấy trang')} | TraceWeaver`;
}
