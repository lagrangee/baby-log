import { errorResponse, jsonResponse } from "./server/http";
import { handleApiRequest } from "./server/routes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const apiResponse = await handleApiRequest(request, env);
      if (apiResponse) return apiResponse;
      return serveAsset(request, env);
    } catch (error) {
      return errorResponse(error);
    }
  }
};

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
