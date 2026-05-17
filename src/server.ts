import { existsSync } from "node:fs"; // fs == filesystem
import { join, normalize } from "node:path";
import { FRONTEND_DIST_DIR } from "./lib/constants";
import { getDatabase } from "./lib/database";
import { ensureRuntimeDirectories } from "./lib/filesystem";
import { logEvent } from "./lib/logger";
import { handleApiRequest } from "./routes/api";

/**
 * Serves static frontend assets from the dist folder.
 * Supports Astro's file output shape and prevents directory traversal attacks.
 */
async function serveFrontendAsset(pathname: string): Promise<Response> {
  // Check if the frontend build directory exists
  if (!existsSync(FRONTEND_DIST_DIR)) {
    return new Response(
      "Frontend build not found. Run 'cd frontend && bun run build' for production assets.",
      {
        status: 404,
      },
    );
  }

  // Root path should serve index.html; other routes should resolve to their folder index.
  const requestedPath = pathname === "/" ? "/index.html" : pathname;

  // Remove leading slashes/backslashes to prevent path traversal
  const normalizedPath = normalize(requestedPath).replace(/^[/\\]+/, "");

  // Reject any paths containing ".." to prevent directory traversal attacks
  if (normalizedPath.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  // Try to serve the exact file requested first.
  const exactFile = Bun.file(join(FRONTEND_DIST_DIR, normalizedPath));

  if (await exactFile.exists()) {
    return new Response(exactFile);
  }

  // Astro builds page routes as folder indexes, such as /scanner/index.html.
  const routeIndex = Bun.file(
    join(FRONTEND_DIST_DIR, normalizedPath, "index.html"),
  );

  if (await routeIndex.exists()) {
    return new Response(routeIndex);
  }

  // Fallback to index.html for the landing page.
  const fallback = Bun.file(join(FRONTEND_DIST_DIR, "index.html"));

  if (await fallback.exists()) {
    return new Response(fallback);
  }

  // Return 404 if neither exact file nor fallback exists
  return new Response("Not found", { status: 404 });
}

// Initialize runtime directories (data/, qrs/, exports/)
// Directories are created at runtime — specifically when the server starts
// this happens before any requests are processed, ensuring the necessary filesystem structure is in place for the app to function correctly. If the directories already exist, this function will simply do nothing, making it safe to call on every startup without risk of overwriting existing data.
ensureRuntimeDirectories();

// Initialize SQLite database connection
getDatabase();

// Read PORT from environment or default to 3001
const port = Number(process.env.PORT ?? "3001");

// Start Bun HTTP server
const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    // /scan is a friendly alias for the scanner page used on release startup.
    if (request.method === "GET" && url.pathname === "/scan") {
      const redirectUrl = new URL("/scanner", request.url);
      redirectUrl.search = url.search;
      return Response.redirect(redirectUrl, 302);
    }

    // Route API requests to the API handler
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request);
    }

    // Route GET/HEAD requests to frontend asset serving (static files + SPA)
    if (request.method === "GET" || request.method === "HEAD") {
      return serveFrontendAsset(url.pathname);
    }

    // Reject all other HTTP methods
    return new Response("Not found", { status: 404 });
  },
});

// Log successful startup with connection details
logEvent("Kichi server started", {
  port,
  apiBase: `http://localhost:${port}/api`,
});

// Open the scanner page automatically on Windows for packaged releases.
if (process.platform === "win32" && process.env.KICHI_NO_BROWSER !== "true") {
  const browserUrl = `http://localhost:${port}/scan`;
  setTimeout(() => {
    const browser = Bun.spawn(["cmd", "/c", "start", "", browserUrl], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    browser.exited.catch(() => {
      // Browser launch failures should not stop the server.
    });
  }, 300);
}
