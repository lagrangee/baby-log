import { useEffect } from "react";
import type { ToastState } from "../types";

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(onDismiss, toast.action ? 5200 : 2400);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={async () => {
            onDismiss();
            await toast.action?.onClick();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}

