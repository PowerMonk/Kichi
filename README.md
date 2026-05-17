# Kichi

Kichi is a local-first QR toolkit for event operations. It converts attendee spreadsheets into per-attendee UUID QR codes, stores records in SQLite, exports ZIP batches, and can send QR attachments by email sequentially.

## Stack

- Runtime: Bun
- Frontend: Astro + Tailwind
- Language: TypeScript
- Database: SQLite via `bun:sqlite`

## Prerequisites

- Bun installed: https://bun.com/
- Node is optional for editor tooling only; runtime and package manager are Bun.

## Quick Start

1. Install dependencies at repository root:

```bash
bun install
```

2. Install frontend dependencies:

```bash
cd frontend
bun install
cd ..
```

# Kichi

Kichi is a local-first QR toolkit for event operations. It converts attendee spreadsheets into per-attendee UUID QR codes, stores records in SQLite, exports ZIP batches, and can send QR attachments by email sequentially.

## Contents

- [Stack](#stack)
- [Alpha Release](#alpha-release)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Production Run](#production-run)
- [Data Directories](#data-directories)
- [Test Data](#test-data)
- [API Endpoints](#api-endpoints)
- [Email Configuration](#email-configuration)
- [Contributor Guide](#contributor-guide)
- [Architecture Notes](#architecture-notes)

## Stack

- Runtime: Bun
- Frontend: Astro + Tailwind
- Language: TypeScript
- Database: SQLite via `bun:sqlite`

## Alpha Release

The alpha release is scan-first and user-friendly:

- The app starts in user mode and opens the scanner page automatically.
- QR generation and email delivery stay hidden until the home-page admin button is unlocked.
- The executable reads paths from the current working directory, so users can place the release in any folder name they want.

Expected release layout:

```text
Kichi_Release/
  kichi.exe
  data/
    kichi.db
  frontend/
    dist/
```

The database file must be named exactly `kichi.db`.

## Prerequisites

- Bun installed: https://bun.com/
- Node is optional for editor tooling only; runtime and package manager are Bun.

## Quick Start

1. Install dependencies at repository root:

```bash
bun install
```

2. Install frontend dependencies:

```bash
cd frontend
bun install
cd ..
```

3. Run the backend API server during development:

```bash
bun run dev
```

4. In a second terminal, run Astro UI for rapid frontend iteration:

```bash
cd frontend
bun run dev
```

5. Open the Astro app at `http://localhost:4321`.

## Production Run

This mode serves the built Astro files and the API from one Bun process.

1. Build the frontend:

```bash
bun run build:frontend
```

2. Compile the Bun executable into the release folder:

```bash
bun build src/server.ts --compile --outfile Kichi_Release/kichi.exe
```

3. Copy the Astro build output into `Kichi_Release/frontend/dist`.

4. Put the SQLite database at `Kichi_Release/data/kichi.db`.

5. Start the executable from inside the release folder.

The server opens `http://localhost:3001/scan` automatically on Windows. The `/scan` path redirects to the scanner page.

## Data Directories

Kichi writes runtime data under the current working directory:

- `data/kichi.db`: persistent SQLite database
- `data/qrs/`: generated PNG QR files
- `data/exports/`: generated ZIP batches

These directories are created automatically when the server starts.

## Test Data

- Root sample file: `example.csv`
- Frontend demo asset: `frontend/public/example.csv`

The UI demo button loads this CSV so you can test the full pipeline quickly.

## API Endpoints

- `GET /api/health`
- `POST /api/parse` (multipart form-data: `file`)
- `POST /api/generate` (multipart form-data: `file`, `map`, `sendEmails`)
- `POST /api/send-emails` (JSON: `entries`)
- `POST /api/scan` (JSON: `uuid`)
- `GET /scan` (alias for the scanner page)
- `GET /api/download/qr/:fileName`
- `GET /api/download/zip/:fileName`

### Generate Payload Notes

- `map` is JSON string with:
  - `name`
  - `email`
  - `role`
  - `controlNumber`
- `sendEmails` is `true` or `false`

## Email Configuration

If you want sequential email sending enabled, create `.env` from `.env.example` and configure SMTP:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

If SMTP values are not configured, generation still succeeds and email sending is skipped safely.

## Contributor Guide

### Recommended Branch Workflow

1. Create a branch from the latest main branch.
2. Keep changes scoped.
3. Run checks before opening a PR.
4. Include the goal, changed files, and how to test it.

### Local Validation Checklist

From repository root:

```bash
bun run dev
```

From the frontend folder:

```bash
cd frontend
bun run dev
bun run build
```

Then verify:

- Demo CSV loads from the UI.
- Parse returns columns.
- Generate creates PNGs in `data/qrs`.
- ZIP export appears in `data/exports`.
- Records persist in `data/kichi.db`.

### Coding Expectations

- Keep logic explicit and deterministic.
- Avoid hidden magic or overly generic abstractions.
- Log major operations and failures.
- Never crash on user input errors.
- Keep offline behavior intact.

## Architecture Notes

Read the detailed pipeline and startup flow in:

- `src/PIPELINE_FLOW.md`
