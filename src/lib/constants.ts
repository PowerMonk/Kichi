import { join } from "node:path";

export const ROOT_DIR = process.cwd();
export const DATA_DIR = join(ROOT_DIR, "data");
export const QR_DIR = join(DATA_DIR, "qrs");
export const EXPORT_DIR = join(DATA_DIR, "exports");
export const DB_PATH = join(DATA_DIR, "kichi.db");
export const FRONTEND_DIST_DIR = join(ROOT_DIR, "frontend", "dist");

export const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx"]);
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
