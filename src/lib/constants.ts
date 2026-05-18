import { join } from "node:path";
import { fileURLToPath } from "node:url";

// cwd for executable use when using kichi.exe
export const ROOT_DIR = process.cwd();
// Resolve root relative to this file to avoid cwd mismatches
// export const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));
export const DATA_DIR = join(ROOT_DIR, "data");
export const QR_DIR = join(DATA_DIR, "qrs");
export const EXPORT_DIR = join(DATA_DIR, "exports");
export const ITINERARY_IMAGE_PATH = join(DATA_DIR, "Itinerario.png");
export const DB_PATH = join(DATA_DIR, "kichi.db");
export const FRONTEND_DIST_DIR = join(ROOT_DIR, "frontend", "dist");

export const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx"]);
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
