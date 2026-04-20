import { Database } from "bun:sqlite";
import { DB_PATH } from "./constants";

let database: Database | null = null;

export interface PersistRecordInput {
  uuid: string;
  name: string;
  email: string;
  role: string;
  controlNumber: string;
  qrFilePath: string;
}

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  database = new Database(DB_PATH, { create: true });
  database.exec("PRAGMA journal_mode = WAL;");

  database.exec(`
    CREATE TABLE IF NOT EXISTS attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      control_number TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendee_uuid TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return database;
}

export function controlNumberExists(controlNumber: string): boolean {
  const db = getDatabase();
  const query = db.query(
    "SELECT control_number FROM attendees WHERE control_number = ? LIMIT 1",
  );
  const existing = query.get(controlNumber) as {
    control_number: string;
  } | null;

  return existing !== null;
}

export function persistRecord(input: PersistRecordInput): void {
  const db = getDatabase();
  const transaction = db.transaction((record: PersistRecordInput) => {
    db.query(
      "INSERT INTO attendees (uuid, name, email, role, control_number) VALUES (?, ?, ?, ?, ?)",
    ).run(
      record.uuid,
      record.name,
      record.email,
      record.role,
      record.controlNumber,
    );

    db.query(
      "INSERT INTO qr_codes (attendee_uuid, file_path) VALUES (?, ?)",
    ).run(record.uuid, record.qrFilePath);
  });

  transaction(input);
}
