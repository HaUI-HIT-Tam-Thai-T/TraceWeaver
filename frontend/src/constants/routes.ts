import { createElement, lazy, Suspense } from "react";
import { AuthCallbackPage } from "../pages/AuthCallbackPage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
const EventsPage = lazy(() =>
  import("../pages/EventsPage").then((module) => ({
    default: module.EventsPage,
  })),
);

const CasesPage = lazy(() =>
  import("../pages/CasesPage").then((module) => ({
    default: module.CasesPage,
  })),
);
const CaseDetailPage = lazy(() =>
  import("../pages/CaseDetailPage").then((module) => ({
    default: module.CaseDetailPage,
  })),
);

const KnowledgePage = lazy(() => import('../pages/KnowledgePage').then(module => ({ default: module.KnowledgePage })));

const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })));

export const ROUTES = [
  { path: '/dashboard', element: createElement(Suspense, { fallback: createElement('p', { role: 'status' }, 'Đang tải Dashboard…') }, createElement(DashboardPage)) },
  { path: '/knowledge', element: createElement(Suspense, { fallback: createElement('p', { role: 'status' }, 'Đang tải Knowledge…') }, createElement(KnowledgePage)) },
  {
    path: "/cases",
    element: createElement(
      Suspense,
      { fallback: createElement("p", { role: "status" }, "Đang tải Cases…") },
      createElement(CasesPage),
    ),
  },
  {
    path: "/cases/:caseId",
    element: createElement(
      Suspense,
      { fallback: createElement("p", { role: "status" }, "Đang tải case…") },
      createElement(CaseDetailPage),
    ),
  },
  { path: "/", element: createElement(HomePage) },
  {
    path: "/events",
    element: createElement(
      Suspense,
      { fallback: createElement("p", { role: "status" }, "Đang tải Events…") },
      createElement(EventsPage),
    ),
  },
  { path: "/auth/callback", element: createElement(AuthCallbackPage) },
  { path: "*", element: createElement(NotFoundPage) },
];
