import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ESM replacement for __dirname.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env vars from backend/.env (not from repo root).
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export const MONGO_URI = process.env.MONGO_URI;
export const PORT = Number(process.env.PORT || 5000);
export const NODE_ENV = process.env.NODE_ENV || "development";

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const JWT_SECRET = process.env.JWT_SECRET;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!MONGO_URI) {
  // Fail fast so config issues are obvious.
  throw new Error("Missing MONGO_URI in backend/.env");
}

