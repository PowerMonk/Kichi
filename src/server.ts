import { existsSync } from "node:fs"; // fs == filesystem
import { join, normalize } from "node:path";
import { FRONTEND_DIST_DIR } from "./lib/constants";
import { getDatabase } from "./lib/database";
import { ensureRuntimeDirectories } from "./lib/filesystem";
import { logEvent } from "./lib/logger";
import { handleApiRequest } from "./routes/api";

/**
 * Serves static frontend assets from the dist folder.
 * Falls back to index.html for SPA (Single Page Application) routing.
 * Prevents directory traversal attacks with path normalization.
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

  // Root path should serve index.html; all other paths serve as-is
  const requestedPath = pathname === "/" ? "/index.html" : pathname;

  // Remove leading slashes/backslashes to prevent path traversal
  const normalizedPath = normalize(requestedPath).replace(/^[/\\]+/, "");

  // Reject any paths containing ".." to prevent directory traversal attacks
  if (normalizedPath.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  // Try to serve the exact file requested
  const exactFile = Bun.file(join(FRONTEND_DIST_DIR, normalizedPath));

  if (await exactFile.exists()) {
    return new Response(exactFile);
  }

  // Fallback to index.html for SPA routing (allows client-side routing to work)
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
Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

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
