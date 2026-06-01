interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  READ_PASSWORD?: string;
  SESSION_SECRET?: string;
  ALLOW_DEV_DEFAULT_PASSWORDS?: string;
  READ_ONLY_REMOTE_D1_PROBE?: string;
}
