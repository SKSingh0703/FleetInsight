# Transport ERP-lite (MERN Skeleton)

## Phase 0: Setup

### Backend (Express + MongoDB)
```powershell
cd backend
npm install
npm run dev
```

Health check:
- `GET http://localhost:5000/health`

API placeholders:
- `POST /api/upload`
- `GET /api/vehicle/:vehicleNumber`
- `GET /api/dashboard`

MongoDB connection is handled in `backend/config/db.js` and reads env vars from `backend/config/env.js` (`backend/.env`).

### Frontend (Vite + React + Tailwind)
```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on:
- `http://localhost:5173`

