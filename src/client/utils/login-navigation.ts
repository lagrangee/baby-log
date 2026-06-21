export type LoginRole = "admin" | "read";

export function completeLoginNavigation(role: LoginRole, onNavigate: (path: string) => void, location: Pick<Location, "assign"> = window.location): void {
  const nextPath = role === "admin" ? "/app" : "/read";
  location.assign(nextPath);
}
