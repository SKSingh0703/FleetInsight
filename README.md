# FleetInsight (Transport ERP-lite)

FleetInsight is a MERN-style application built for fleet/transport operations.
It supports:

- **Trip ingestion** from Excel (`.xlsx`) uploads
- **Search & filters** across trips (vehicle, invoice, chassis, book, party, date ranges)
- **Dashboard** summary + recent trips with server-side aggregation and caching
- **Google Sign-In** (JWT session) and **admin approval workflow**
- **Admin panel** (user approval, role management)
- **Google Sheets integration** with periodic sync and “Sync now”

This repository contains two projects:

- `backend/` — Express + MongoDB (Mongoose)
- `frontend/` — Vite + React + TypeScript + shadcn/ui

---

## Quick start (local development)

### 1) Backend

Create `backend/.env` (see **Environment variables** below), then:

```powershell
cd backend
npm install
npm run dev
```

Backend runs on:

- `http://localhost:5000`

Health check:

- `GET http://localhost:5000/health`

### 2) Frontend

Create `frontend/.env` (see **Environment variables** below), then:

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on:

- `http://localhost:8080`

---

## Environment variables

### Backend (`backend/.env`)

Required:

- `MONGO_URI`
  - Mongo connection string
  - Example (Atlas): `mongodb+srv://USER:PASSWORD@cluster0.xxx.mongodb.net/fleetinsight?retryWrites=true&w=majority`
- `JWT_SECRET`
  - Secret used to sign your backend-issued JWT
- `GOOGLE_CLIENT_ID`
  - Google OAuth client ID (used to verify Google login tokens on the backend)

Optional:

- `PORT`
  - Default: `5000`
- `NODE_ENV`
  - Default: `development`
- `ADMIN_EMAIL`
  - If set, can be used to bootstrap initial admin access depending on backend logic

Uploads:

- `UPLOAD_MAX_MB`
  - Max upload size in MB (Multer).
  - Default: `25`
  - Oversized uploads return `413` with a user-friendly message.

Sheet sync reliability / operations:

- `SHEETS_SYNC_RUN_STALE_MINUTES`
  - Default: `30`
  - On server start, any sync run stuck in `RUNNING` older than this is marked `FAILED`.
- `SHEETS_SYNC_RUNS_MAX`
  - Default: `200`
  - Retains the last N sync runs and prunes older history.

Maintenance / one-time:

- `BACKFILL_TRIPKEYS`
  - If `true`, backfills legacy trip documents missing `tripKey` on startup.

Google Sheets service account credentials (pick one approach):

Option A (recommended):

- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`
  - If your host can’t store multiline strings, you can provide the private key with literal `\n` and it will be converted.

Option B:

- `GOOGLE_SHEETS_SA_JSON`
  - Raw JSON string of the service account key

Option C:

- `GOOGLE_SHEETS_SA_JSON_BASE64`
  - Base64 encoded service account JSON

Notes:

- The Sheets integration uses **read-only** scope (`spreadsheets.readonly`).
- You must share the target spreadsheet with the service account email.

### Frontend (`frontend/.env`)

Required:

- `VITE_GOOGLE_CLIENT_ID`
  - Google OAuth client ID used by the browser

Optional:

- `VITE_API_URL`
  - Backend base URL
  - Default: `http://localhost:5000`

---

## Core flows

### Authentication and approval

- Users sign in with Google on the frontend.
- Frontend exchanges the Google credential with the backend.
- Backend returns a JWT + user profile.
- If the user is not approved, they land on the **Pending** screen.
- When an admin approves the user, clicking **Check approval status** refreshes the session and redirects into the app.

#### Expired/invalid token behavior (professional UX)

- Any API call that receives `401` triggers a global “session expired” handler.
- The app clears the local token and redirects to `/login` instead of displaying raw JSON errors.

### Upload trips (`.xlsx`)

- Endpoint: `POST /api/upload` (multipart form-data, field name: `file`)
- File type: `.xlsx` only
- File size limit: controlled by `UPLOAD_MAX_MB` (default 25MB)
- The backend deletes the uploaded file from disk after processing.

### Dashboard

- Endpoint: `GET /api/dashboard?month=<1-12>&year=<yyyy>&limit=<n>`
- Returns:
  - `summary`: totals (trips, revenue, expenses, profit)
  - `trips`: most recent trips (limited payload)
- Uses a short in-memory TTL cache to reduce repeated heavy aggregations.
- Cache is invalidated when trips are modified by:
  - Upload upserts
  - Google Sheets sync upserts

### Search

- Endpoint: `POST /api/search`
- Designed for user-driven filtering.
- Frontend requests are cancellable (AbortSignal), reducing noisy “aborted” logs.

### Google Sheets sync

- Admin config + status endpoints live under `/api/admin/sheetsync...`
- Scheduler runs periodically based on admin configuration.
- Manual trigger: `POST /api/admin/sheetsync/run`

Reliability mechanisms:

- **Distributed lock (Mongo)** prevents concurrent sync runs.
- Lock includes **auto-renewal**, so long sync runs don’t outlive the TTL.
- On crash/restart:
  - lock expires naturally
  - stale `RUNNING` runs are marked `FAILED` on next startup
- Scheduler includes **backoff on repeated failures** (reduces log spam when DB/network is down).
- Google Sheets API reads have **exponential backoff + retry** for transient/quota failures.

---

## Running in production

### Backend

- Use `npm run start` (not `npm run dev`).
- Set environment variables via the hosting platform.
- Set:
  - `NODE_ENV=production`

Recommended operational setup:

- Run the backend under a process manager (PM2/systemd/container platform).
- Set up log rotation / centralized logging.
- Prefer hosting backend close to MongoDB (same region/VPC) to reduce network errors.

### Frontend

- Build: `npm run build`
- Serve the static output via your hosting provider.
- Configure:
  - `VITE_API_URL` to point to your hosted backend
  - `VITE_GOOGLE_CLIENT_ID`

---

## Troubleshooting

### “Failed to fetch” / can’t connect

- If the backend is stopped, login now shows a user-friendly alert (“Can’t reach the server”) with a Retry action.
- Confirm backend is running and `VITE_API_URL` points to the correct host.

### 401 / session expired

- The app automatically logs out and redirects to `/login`.
- If you see repeated 401s, clear local storage and sign in again.

### Mongo auth errors (Atlas)

If you see:

- `MongoServerError: bad auth : authentication failed`

Then `MONGO_URI` credentials are wrong or the password has special characters that need URL-encoding.

### Upload too large

- Oversized uploads return `413` with a message indicating the max allowed size.
- Adjust with `UPLOAD_MAX_MB`.

---

## API overview (high level)

All endpoints below are under the backend base URL (default `http://localhost:5000`).

- `GET /health`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `POST /api/upload`
- `GET /api/dashboard`
- `POST /api/search`

Admin (requires approved admin user):

- `GET /api/admin/users`
- `POST /api/admin/approve/:userId`
- `POST /api/admin/reject/:userId`
- `POST /api/admin/make-admin/:userId`
- `POST /api/admin/remove/:userId`

Sheets:

- `GET /api/admin/sheetsync`
- `POST /api/admin/sheetsync/config`
- `POST /api/admin/sheetsync/run`
- `GET /api/admin/sheetsync/suggest?spreadsheetId=...`
- `GET /api/admin/sheetsync/runs`

---

## Notes & future improvements

- **Timezone**: the system currently uses UTC-based month boundaries in a few places.
  - If the product is India-only, migrating business logic to IST (`Asia/Kolkata`) is recommended so month filtering aligns with Indian local time.
- **Very large Sheets**: current sheet sync reads full configured ranges into memory.
  - For 10k+ rows, consider chunked reads/pagination as a future improvement.


