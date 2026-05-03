import { Database } from "bun:sqlite";
import { DB_PATH } from "./constants";

/**
 * Singleton instance of the SQLite database.
 * Lazy-loaded on first access to ensure proper initialization.
 */
let database: Database | null = null;

/**
 * Input structure for persisting an attendee record to the database.
 * Includes all data needed to create both attendee and QR code records.
 */
export interface PersistRecordInput {
  uuid: string;
  name: string;
  email: string;
  role: string;
  controlNumber: string;
  qrFilePath: string;
}

export interface AttendeeRecord {
  uuid: string;
  name: string;
  email: string;
  role: string;
  controlNumber: string;
}

interface IndexInfoRow {
  name: string;
  unique: number;
}

interface IndexColumnRow {
  name: string;
}

/**
 * Gets or initializes the SQLite database singleton.
 * Creates the database file at DB_PATH if it doesn't exist.
 * Initializes database schema (attendees and qr_codes tables) on first run.
 * Uses WAL (Write-Ahead Logging) for better concurrency.
 */
export function getDatabase(): Database {
  // Return existing database connection if already initialized
  if (database) {
    return database;
  }

  // Create new database connection (creates file if it doesn't exist)
  database = new Database(DB_PATH, { create: true });

  // Enable WAL mode for better concurrency and reliability
  // WAL allows readers and writers to coexist without blocking each other
  database.run("PRAGMA journal_mode = WAL;");

  // Create attendees table if it doesn't exist
  // Stores core attendee information and UUID mapping
  database.run(`
    CREATE TABLE IF NOT EXISTS attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      control_number TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Create QR codes table if it doesn't exist
    -- Links QR images to attendees and stores file paths
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendee_uuid TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureControlNumberNotUnique(database);

  return database;
}

function ensureControlNumberNotUnique(db: Database): void {
  const indexes = db
    .query("PRAGMA index_list(attendees)")
    .all() as IndexInfoRow[];

  const hasUniqueControlNumber = indexes.some((index) => {
    if (!index.unique) return false;
    const safeIndexName = index.name.replace(/'/g, "''");
    const columns = db
      .query(`PRAGMA index_info('${safeIndexName}')`)
      .all() as IndexColumnRow[];
    return columns.some((column) => column.name === "control_number");
  });

  if (!hasUniqueControlNumber) return;

  db.run("PRAGMA foreign_keys = OFF;");
  db.run("BEGIN;");
  db.run(`
    CREATE TABLE attendees_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      control_number TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    INSERT INTO attendees_new (id, uuid, name, email, role, control_number, created_at)
    SELECT id, uuid, name, email, role, control_number, created_at FROM attendees;
  `);
  db.run("DROP TABLE attendees;");
  db.run("ALTER TABLE attendees_new RENAME TO attendees;");
  db.run("COMMIT;");
  db.run("PRAGMA foreign_keys = ON;");
}

/**
 * Checks if a control number already exists in the database.
 * Used to prevent duplicate control numbers during QR generation.
 * Returns true if found, false if not found.
 */
export function controlNumberExists(controlNumber: string): boolean {
  const db = getDatabase();

  // Query for a record with the given control number
  const query = db.query(
    "SELECT control_number FROM attendees WHERE control_number = ? LIMIT 1",
  );
  const existing = query.get(controlNumber) as {
    control_number: string;
  } | null;

  // Return true if found, false if not found
  return existing !== null;
}

/**
 * Fetches a single attendee by UUID.
 * Returns null if no matching attendee exists.
 */
export function getAttendeeByUuid(uuid: string): AttendeeRecord | null {
  const db = getDatabase();

  const query = db.query(
    "SELECT uuid, name, email, role, control_number FROM attendees WHERE uuid = ? LIMIT 1",
  );

  const row = query.get(uuid) as {
    uuid: string;
    name: string;
    email: string;
    role: string;
    control_number: string;
  } | null;

  if (!row) return null;

  return {
    uuid: row.uuid,
    name: row.name,
    email: row.email,
    role: row.role,
    controlNumber: row.control_number,
  };
}

/**
 * Persists a complete attendee record to the database.
 * Inserts into both attendees and qr_codes tables in a single transaction.
 * Ensures both inserts succeed or both fail (atomic operation).
 * Throws if either insert fails (e.g., duplicate UUID).
 */
export function persistRecord(input: PersistRecordInput): void {
  const db = getDatabase();

  // Define transaction: both inserts must succeed or both must fail
  const transaction = db.transaction((record: PersistRecordInput) => {
    // Insert attendee record with UUID and metadata
    db.query(
      "INSERT INTO attendees (uuid, name, email, role, control_number) VALUES (?, ?, ?, ?, ?)",
    ).run(
      record.uuid,
      record.name,
      record.email,
      record.role,
      record.controlNumber,
    );

    // Insert QR code reference linked to the attendee's UUID
    db.query(
      "INSERT INTO qr_codes (attendee_uuid, file_path) VALUES (?, ?)",
    ).run(record.uuid, record.qrFilePath);
  });

  // Execute the transaction
  transaction(input);
}
