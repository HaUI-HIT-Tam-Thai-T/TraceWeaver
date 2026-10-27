import { createElement, lazy, Suspense } from "react";
import { AuthCallbackPage } from "../pages/AuthCallbackPage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
const EventsPage = lazy(() =>
  import("../pages/EventsPage").then((module) => ({
    default: module.EventsPage,
  })),
);

export const ROUTES = [
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
