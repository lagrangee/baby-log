interface HttpsLocation {
  href: string;
  replace(url: string): void;
}

export function enforcePublicHttps(location: HttpsLocation = window.location): boolean {
  const url = new URL(location.href);
  if (url.protocol !== "http:" || isLocalHost(url.hostname)) return false;
  url.protocol = "https:";
  location.replace(url.toString());
  return true;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
