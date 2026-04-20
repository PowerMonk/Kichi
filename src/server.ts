import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import { FRONTEND_DIST_DIR } from "./lib/constants";
import { getDatabase } from "./lib/database";
import { ensureRuntimeDirectories } from "./lib/filesystem";
import { logEvent } from "./lib/logger";
import { handleApiRequest } from "./routes/api";

async function serveFrontendAsset(pathname: string): Promise<Response> {
  if (!existsSync(FRONTEND_DIST_DIR)) {
    return new Response(
      "Frontend build not found. Run 'cd frontend && bun run build' for production assets.",
      {
        status: 404,
      },
    );
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = normalize(requestedPath).replace(/^[/\\]+/, "");

  if (normalizedPath.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  const exactFile = Bun.file(join(FRONTEND_DIST_DIR, normalizedPath));

  if (await exactFile.exists()) {
    return new Response(exactFile);
  }

  const fallback = Bun.file(join(FRONTEND_DIST_DIR, "index.html"));

  if (await fallback.exists()) {
    return new Response(fallback);
  }

  return new Response("Not found", { status: 404 });
}

ensureRuntimeDirectories();
getDatabase();

const port = Number(process.env.PORT ?? "3001");

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request);
    }

    if (request.method === "GET" || request.method === "HEAD") {
      return serveFrontendAsset(url.pathname);
    }

    return new Response("Not found", { status: 404 });
  },
});

logEvent("Kichi server started", {
  port,
  apiBase: `http://localhost:${port}/api`,
});
