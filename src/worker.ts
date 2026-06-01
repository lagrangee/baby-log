import { errorResponse, jsonResponse } from "./server/http";
import { handleApiRequest } from "./server/routes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (isBlockedByReadOnlyRemoteD1Probe(request, env)) {
        return jsonResponse(
          { error: "Read-only remote D1 probe rejects mutating requests" },
          {
            status: 405,
            headers: {
              allow: "GET, HEAD, OPTIONS"
            }
          }
        );
      }
      const apiResponse = await handleApiRequest(request, env);
      if (apiResponse) return apiResponse;
      return serveAsset(request, env);
    } catch (error) {
      return errorResponse(error);
    }
  }
};

function isBlockedByReadOnlyRemoteD1Probe(request: Request, env: Env): boolean {
  if (env.READ_ONLY_REMOTE_D1_PROBE !== "true") return false;
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const pathname = new URL(request.url).pathname;
  return !["/api/session/admin/login", "/api/session/read/login", "/api/session/logout"].includes(pathname);
}

async function serveAsset(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.startsWith("/machine/")) {
    return jsonResponse(
      { error: "Machine endpoint not found" },
      {
        status: 404,
        headers: {
          "x-robots-tag": "noindex"
        }
      }
    );
  }
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || !request.headers.get("accept")?.includes("text/html")) {
    return response;
  }
  const url = requestUrl;
  url.pathname = "/index.html";
  return env.ASSETS.fetch(new Request(url, request));
}
