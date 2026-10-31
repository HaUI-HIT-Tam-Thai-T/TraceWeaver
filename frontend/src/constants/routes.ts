import { createElement, lazy } from "react";
import { Navigate } from "react-router-dom";
import { AuthCallbackPage } from "../pages/AuthCallbackPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { EventDetailPage } from "../pages/EventDetailPage";
import { PageLoadError } from "../routes/PageLoadFeedback";
import { WorkspaceAdminPage } from "../pages/WorkspaceAdminPage";

const EventsPage = lazy(() =>
  import("../pages/EventsPage")
    .then((module) => ({ default: module.EventsPage }))
    .catch(() => ({ default: PageLoadError })),
);
const CasesPage = lazy(() =>
  import("../pages/CasesPage")
    .then((module) => ({ default: module.CasesPage }))
    .catch(() => ({ default: PageLoadError })),
);
const CaseDetailPage = lazy(() =>
  import("../pages/CaseDetailPage")
    .then((module) => ({ default: module.CaseDetailPage }))
    .catch(() => ({ default: PageLoadError })),
);
const KnowledgePage = lazy(() =>
  import("../pages/KnowledgePage")
    .then((module) => ({ default: module.KnowledgePage }))
    .catch(() => ({ default: PageLoadError })),
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage")
    .then((module) => ({ default: module.DashboardPage }))
    .catch(() => ({ default: PageLoadError })),
);

export const APP_ROUTES = [
  { path: "/workspace-admin", element: createElement(WorkspaceAdminPage) },
  { path: "/dashboard", element: createElement(DashboardPage) },
  { path: "/knowledge", element: createElement(KnowledgePage) },
  { path: "/cases", element: createElement(CasesPage) },
  { path: "/cases/:caseId", element: createElement(CaseDetailPage) },
  { path: "/", element: createElement(Navigate, { to: "/dashboard", replace: true }) },
  { path: "/events", element: createElement(EventsPage) },
  { path: "/events/:eventId", element: createElement(EventDetailPage) },
];

export const PUBLIC_ROUTES = [
  { path: "/auth/callback", element: createElement(AuthCallbackPage) },
  { path: "*", element: createElement(NotFoundPage) },
];

export const ROUTES = [...APP_ROUTES, ...PUBLIC_ROUTES];
