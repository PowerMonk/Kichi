# Kichi — Copilot Instructions (V1)

## Purpose

Kichi is a **local-first QR toolkit for events**. It converts attendee lists into unique QR codes, stores them in a local database, and distributes them via email. The system is designed to run **offline**, be simple to deploy, and behave reliably in real-world environments such as university congresses.

The philosophy is:

- Local-first
- Minimal friction
- Deterministic behavior
- Engineer-grade reliability
- No cloud dependency

This document defines the **technical and architectural rules** that Copilot must follow when generating code for this project.

---

# Core Principles

1. The system must run completely offline.
2. The database must persist on disk.
3. All outputs must be deterministic and reproducible.
4. Simplicity is preferred over abstraction.
5. Reliability is more important than cleverness.
6. All functionality must be explainable to a non-programmer organizer.

---

# Version Scope

## V1 — QR Generation

The first version of Kichi focuses ONLY on generating QR codes from spreadsheet data.

Required capabilities:

- Import CSV files
- Import XLSX files
- Parse rows into structured records
- Generate UUID per record
- Generate one QR per row
- Save QR images locally
- Store records in SQLite
- Send QR codes via email
- Export QR batch as ZIP

Deployment note for V1:

- The first live event is a school congress, and `control_number` is required for every attendee row.
- Keep the data model and mapping flow ready for future event profiles where a different identifier column may be required.

Not included in V1:

- QR scanning
- Cooldown logic
- Multi-event tracking
- Cloud deployment
- Authentication
- User accounts

These belong to future versions.

---

# Technology Stack

Runtime:

- Bun

Frontend:

- Astro
- Tailwind CSS

Database:

- SQLite (built into Bun)

Language:

- TypeScript

Package Manager:

- Bun

---

# Required Libraries

QR Generation:

- qrcode

Spreadsheet Parsing:

- xlsx

UUID Generation:

- crypto.randomUUID (built-in)

Email Delivery:

- nodemailer

File Compression:

- archiver

Database Access:

- bun:sqlite

---

# System Architecture

Browser

→ Astro UI

→ Bun server

→ SQLite database file

All components run on the same machine.

No external services are required.

---

# Project Structure

evento-app/

frontend/

src/

server.ts

lib/

routes/

services/

qr/

email/

data/

kichi.db

qrs/

exports/

package.json

bun.lock

---

# Database Rules

The database must always be stored in:

/data/kichi.db

The database file must persist between runs.

Never use in-memory databases.

Never delete the database automatically.

---

# Database Schema

## Table: attendees

Fields:

id

integer primary key

uuid

text unique

name

text

email

text

role

text

control_number

text unique

created_at

timestamp

---

## Table: qr_codes

Fields:

id

integer primary key

attendee_uuid

text

file_path

text

created_at

timestamp

---

# UUID Rules

Every row must receive a UUID.

Use:

crypto.randomUUID()

Never reuse UUID values.

UUID is the system identity.

---

# QR Code Rules

Each QR code must contain ONLY:

UUID

Never embed personal data inside the QR.

QR images must be:

PNG format

300 DPI equivalent

Square

High contrast

---

# File Naming Rules

For the first school congress deployment (V1), QR files must be named using:

control_number

Example:

22123456.png

For future event profiles, the required filename identifier must be configurable (for example: badge_id, athlete_id, passport_id) while remaining unique and deterministic per attendee row.

Never use names as filenames.

Names are not guaranteed to be unique.

---

# QR Output Directory

All generated QR files must be stored in:

/data/qrs/

The directory must be created automatically if it does not exist.

---

# ZIP Export Rules

The system must generate a downloadable ZIP archive containing:

All QR PNG files

Archive location:

/data/exports/

Archive name format:

kichi_qr_batch_TIMESTAMP.zip

---

# Email Delivery Rules

Emails must be sent after QR generation completes.

Each recipient receives:

One email

One QR attachment

Email sending must be sequential.

Never send emails in parallel.

This prevents rate-limit failures.

---

# Email Failure Handling

If email delivery fails:

Log the failure

Continue processing remaining emails

Never crash the system

---

# Spreadsheet Parsing Rules

Supported formats:

CSV

XLSX

The parser must:

Ignore empty rows

Trim whitespace

Normalize column names

Handle missing optional fields

---

# Column Mapping Rules

The UI allows users to map spreadsheet columns.

Core required fields:

name

email

role

Event-required identifier field:

control_number

(required for the first school congress deployment)

Future versions must support different event-specific required tags/columns while preserving the same core workflow.

All other columns could include certain optional or custom fields.

---

# Frontend Rules

Frontend is built using Astro.

The frontend must be static after build.

Production builds must be served by Bun.

Never run Astro dev in production.

---

# Build Rules

Development mode:

astro dev

bun dev

Production build:

astro build

bun start

The production server must:

Serve static files from frontend/dist

Expose API endpoints

Access SQLite database

---

# Local-First Requirement

The application must work without:

Internet

Cloud services

External APIs

User accounts

Authentication

---

# Logging Rules

All major operations must be logged.

Required log events:

File imported

Row parsed

UUID generated

QR generated

Email sent

Email failed

ZIP exported

---

# Error Handling Rules

The system must never crash due to user input.

All errors must:

Be logged

Return safe messages

Allow recovery

---

# Performance Rules

The system must support at least:

1000 attendees

QR generation must complete within:

60 seconds

---

# UI Philosophy

The interface must feel:

Minimal

Sharp

Intentional

Engineering-driven

No visual clutter

No unnecessary animations

No marketing language

---

# UI Workflow

Step 1 — Upload

User uploads:

CSV or XLSX file

---

Step 2 — Map

User selects:

Name column

Email column

Role column

Required event identifier column

(control number for the school congress)

---

Step 3 — Generate

System:

Creates UUIDs

Generates QR codes

Saves files

Sends emails

---

Step 4 — Results

User can:

Download individual QR

Download ZIP batch

Reset workflow

---

# Security Rules

Never execute spreadsheet formulas.

Never trust user input.

Always sanitize strings.

Always validate email addresses.

---

# Portability Requirement

The system must run on:

Any laptop

Without installation of external services

---

# Future Versions (Not V1)

These features are planned but must NOT be implemented yet.

QR scanning

Cooldown logic

Multi-day tracking

Event sessions

Google Sheets integration

Binary packaging

Installer generation

Dashboard analytics

Cloud deployment

---

# Binary Distribution Goal

In future versions, the system should support:

Single executable

Self-contained database

No runtime installation

Double-click launch

---

# Code Style Rules

Use TypeScript strictly.

Avoid unnecessary abstractions.

Prefer explicit logic.

Prefer readable code over clever code.

Keep functions small.

Keep dependencies minimal.

---

# Naming Conventions

Variables:

camelCase

Files:

kebab-case

Database tables:

snake_case

---

# Final Directive

Kichi is not a demo.

Kichi is an operational tool.

All code generated must assume real-world usage in live events.
