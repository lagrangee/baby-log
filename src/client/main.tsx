import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { api, logout } from "./api";
import { AppShell } from "./components/AppShell";
import { Toast } from "./components/Toast";
import { LanguageProvider, useI18n } from "./i18n";
import { ChecklistPage } from "./pages/ChecklistPage";
import { LoginPage } from "./pages/LoginPage";
import { MorePage } from "./pages/MorePage";
import { ReadOnlyPage } from "./pages/ReadOnlyPage";
import { RecordPage } from "./pages/RecordPage";
import { TimelinePage } from "./pages/TimelinePage";
import { TodayPage } from "./pages/TodayPage";
import { YesterdayPage } from "./pages/YesterdayPage";
import type { ShowToast, ToastState } from "./types";

const root = createRoot(document.querySelector<HTMLDivElement>("#app")!);

function App() {
  const [path, setPath] = useState(() => window.location.pathname + window.location.search);
  const [toast, setToast] = useState<ToastState | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname + window.location.search !== nextPath) {
      history.pushState(null, "", nextPath);
    }
    setPath(nextPath);
  }, []);

  const showToast = useCallback<ShowToast>((message, action) => {
    setToast({ id: Date.now(), message, action });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const onLogout = useCallback(
    async (role: "admin" | "read" = "admin") => {
      await logout();
      navigate(role === "read" ? "/login/read" : "/login/admin");
    },
    [navigate]
  );

  const onUnauthorized = useCallback(
    (role: "admin" | "read" = "admin") => {
      navigate(role === "read" ? "/login/read" : "/login/admin");
    },
    [navigate]
  );

  const route = useMemo(() => {
    const pathname = path.split("?")[0] || "/";
    if (pathname === "/" || pathname === "") {
      queueMicrotask(() => navigate("/app"));
      return <div className="loading">{t("app.loading")}</div>;
    }
    if (pathname === "/login/admin") return <LoginPage role="admin" onNavigate={navigate} showToast={showToast} />;
    if (pathname === "/login/read") return <LoginPage role="read" onNavigate={navigate} showToast={showToast} />;
    if (pathname === "/read") return <ReadOnlyPage onLogout={() => onLogout("read")} onUnauthorized={() => onUnauthorized("read")} />;

    if (pathname.startsWith("/app")) {
      const activePath = ["/app/today", "/app/yesterday", "/app/timeline", "/app/checklist", "/app/more"].includes(pathname) ? pathname : "/app";
      return (
        <AppShell activePath={activePath} onNavigate={navigate}>
          {activePath === "/app" ? <RecordPage onLogout={() => onLogout("admin")} onUnauthorized={() => onUnauthorized("admin")} showToast={showToast} /> : null}
          {activePath === "/app/today" ? <TodayPage onLogout={() => onLogout("admin")} onNavigate={navigate} onUnauthorized={() => onUnauthorized("admin")} showToast={showToast} /> : null}
          {activePath === "/app/yesterday" ? <YesterdayPage onUnauthorized={() => onUnauthorized("admin")} showToast={showToast} /> : null}
          {activePath === "/app/timeline" ? (
            <TimelinePage
              search={path.includes("?") ? path.slice(path.indexOf("?")) : ""}
              onNavigate={navigate}
              onUnauthorized={() => onUnauthorized("admin")}
              showToast={showToast}
            />
          ) : null}
          {activePath === "/app/checklist" ? <ChecklistPage onUnauthorized={() => onUnauthorized("admin")} showToast={showToast} /> : null}
          {activePath === "/app/more" ? <MorePage onLogout={() => onLogout("admin")} onUnauthorized={() => onUnauthorized("admin")} showToast={showToast} /> : null}
        </AppShell>
      );
    }

    queueMicrotask(() => navigate("/app"));
    return <div className="loading">{t("app.loading")}</div>;
  }, [path, navigate, showToast, onLogout, onUnauthorized]);

  return (
    <>
      {route}
      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  );
}

root.render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
);

export { api };
