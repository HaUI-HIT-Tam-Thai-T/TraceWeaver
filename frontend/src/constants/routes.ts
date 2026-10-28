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

export const ROUTES = [
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
