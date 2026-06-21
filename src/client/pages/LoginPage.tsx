import { useState } from "react";
import { api } from "../api";
import { LanguageToggle, useI18n } from "../i18n";
import type { ShowToast } from "../types";
import { completeLoginNavigation } from "../utils/login-navigation";

interface LoginPageProps {
  role: "admin" | "read";
  onNavigate: (path: string) => void;
  showToast: ShowToast;
}

export function LoginPage({ role, onNavigate, showToast }: LoginPageProps) {
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    try {
      await api(`/api/session/${role}/login`, {
        method: "POST",
        body: JSON.stringify({ password: String(formData.get("password") ?? "") })
      });
      completeLoginNavigation(role, onNavigate);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("login.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <LanguageToggle />
      <section className="login-panel">
        <p className="eyebrow">{role === "admin" ? t("login.admin") : t("login.read")}</p>
        <h1>{role === "admin" ? "Baby Log" : "Baby Status"}</h1>
        <form className="stack" onSubmit={submit}>
          <label>
            {t("login.password")}
            <input name="password" type="password" autoComplete="current-password" required autoFocus />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {t("login.submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
