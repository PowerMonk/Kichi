# Kichi Pipeline Flow

This document explains exactly how data moves through the system and how to run it.

## Entry Points

### Runtime server

- File: `src/server.ts`
- Starts Bun HTTP server on `PORT` (default `3001`)
- Ensures runtime directories exist
- Initializes SQLite schema
- Routes:
  - `/api/*` to API handlers
  - non-API GET/HEAD to built Astro files from `frontend/dist`

### API routes

- File: `src/routes/api.ts`
- Main handlers:
  - `POST /api/parse`
  - `POST /api/generate`
  - `GET /api/download/qr/:fileName`
  - `GET /api/download/zip/:fileName`

## Parse Flow (`POST /api/parse`)

1. Validate multipart payload has `file`
2. Call `parseSpreadsheetFile` in `src/services/spreadsheet-service.ts`
3. Parse CSV/XLSX with formulas disabled
4. Normalize headers and sanitize cells
5. Remove empty rows
6. Return:
   - columns
   - rowCount
   - preview rows

## Generate Flow (`POST /api/generate`)

Main implementation: `runPipeline` in `src/services/pipeline-service.ts`

1. Validate multipart payload fields:
   - `file`
   - `map` JSON (`name`, `email`, `role`, `controlNumber`)
   - optional `sendEmails`
2. Parse spreadsheet into normalized rows
3. Validate map columns exist in parsed columns
4. Iterate rows one-by-one and for each row:
   - extract mapped values
   - validate required fields
   - validate email format
   - enforce unique `control_number` (in-file and DB)
   - generate UUID with `crypto.randomUUID()`
   - create PNG QR buffer containing only UUID
   - write PNG to `data/qrs/<control_number>.png`
   - persist attendee and qr_code rows in SQLite
   - log major events
5. After row processing:
   - create ZIP in `data/exports/` containing generated PNG files
6. If `sendEmails=true`:
   - call `sendSequentialEmails` in `src/services/email-service.ts`
   - process one recipient at a time
   - log failures, continue processing
7. Return summary payload:
   - totals
   - generated records
   - failures
   - download URLs

## Database Layer

- File: `src/lib/database.ts`
- Engine: `bun:sqlite`
- DB path: `data/kichi.db`
- Tables:
  - `attendees`
  - `qr_codes`
- `getDatabase()` ensures tables exist

## File System Layer

- File: `src/lib/filesystem.ts`
- Ensures:
  - `data/`
  - `data/qrs/`
  - `data/exports/`
- Utilities:
  - safe identifier normalization
  - ZIP filename generator

## QR Generation

- File: `src/services/qr-service.ts`
- Library: `qrcode`
- Output:
  - PNG
  - high-contrast black on white
  - QR content = UUID only

## ZIP Generation

- File: `src/services/zip-service.ts`
- Library: `archiver`
- Produces `kichi_qr_batch_YYYYMMDD_HHMMSS.zip`

## Email Delivery

- File: `src/services/email-service.ts`
- Library: `nodemailer`
- Behavior:
  - only enabled when SMTP env vars are present
  - sequential send loop
  - failures logged and collected

## Frontend Testing Path

- Page: `frontend/src/pages/index.astro`
- Supports:
  - large drag-and-drop upload zone
  - demo CSV preload button
  - parse columns call
  - generate pipeline call
  - results and downloads rendering

## How to Run

### API + Built UI (single process)

1. `bun install`
2. `cd frontend && bun install && bun run build`
3. `cd .. && bun run start`
4. Open `http://localhost:3001`

### API + Astro Dev UI (two processes)

Terminal A:

```bash
bun run dev
```

Terminal B:

```bash
cd frontend
bun run dev
```

Open `http://localhost:4321` for UI development.

## Key Files

- `src/server.ts`
- `src/routes/api.ts`
- `src/services/pipeline-service.ts`
- `src/services/spreadsheet-service.ts`
- `src/services/qr-service.ts`
- `src/services/zip-service.ts`
- `src/services/email-service.ts`
- `src/lib/database.ts`
- `src/lib/filesystem.ts`
- `frontend/src/pages/index.astro`
