import { createElement, lazy } from "react";
import { AuthCallbackPage } from "../pages/AuthCallbackPage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PageLoadError } from "../routes/PageLoadFeedback";

// Declare once so rendering does not recreate the lazy component or reset its state.
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

export const ROUTES = [
  { path: "/dashboard", element: createElement(DashboardPage) },
  { path: "/knowledge", element: createElement(KnowledgePage) },
  { path: "/cases", element: createElement(CasesPage) },
  { path: "/cases/:caseId", element: createElement(CaseDetailPage) },
  { path: "/", element: createElement(HomePage) },
  { path: "/events", element: createElement(EventsPage) },
  { path: "/auth/callback", element: createElement(AuthCallbackPage) },
  { path: "*", element: createElement(NotFoundPage) },
];
