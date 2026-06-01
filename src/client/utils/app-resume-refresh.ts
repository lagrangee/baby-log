interface ResumeRefreshOptions {
  windowTarget?: Pick<Window, "addEventListener" | "removeEventListener"> | EventTarget;
  documentTarget?: (Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> & EventTarget) | null;
  minIntervalMs?: number;
  now?: () => number;
}

export function installAppResumeRefresh(callback: () => void, options: ResumeRefreshOptions = {}): () => void {
  const windowTarget = options.windowTarget ?? window;
  const documentTarget = options.documentTarget ?? document;
  const minIntervalMs = options.minIntervalMs ?? 1500;
  const now = options.now ?? Date.now;
  let lastRefreshAt = 0;

  const refresh = () => {
    if (documentTarget?.visibilityState === "hidden") return;
    const current = now();
    if (current - lastRefreshAt < minIntervalMs) return;
    lastRefreshAt = current;
    callback();
  };

  documentTarget?.addEventListener("visibilitychange", refresh);
  windowTarget.addEventListener("pageshow", refresh);
  windowTarget.addEventListener("focus", refresh);

  return () => {
    documentTarget?.removeEventListener("visibilitychange", refresh);
    windowTarget.removeEventListener("pageshow", refresh);
    windowTarget.removeEventListener("focus", refresh);
  };
}
