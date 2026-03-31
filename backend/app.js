import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

import apiRoutes from "./routes/index.js";

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS;
  const list = typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (list.length > 0) return list;

  const env = String(process.env.NODE_ENV || "development").toLowerCase();
  if (env !== "production") {
    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    ];
  }

  return [];
}

export default function createApp() {
  const app = express();

  const allowedOrigins = parseCorsOrigins();
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.length === 0) return cb(null, false);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 204,
    })
  );
  app.use(express.json());
  app.use(morgan("dev"));

  app.use((req, res, next) => {
    let aborted = false;
    req.on("aborted", () => {
      aborted = true;
    });

    res.on("close", () => {
      if (aborted || req.aborted) {
        // eslint-disable-next-line no-console
        console.warn(`[aborted] ${req.method} ${req.originalUrl}`);
      }
    });

    next();
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database unavailable. Please try again in a moment." });
    }
    return next();
  });

  app.use("/api", apiRoutes);

  // Basic error handler (keeps server from crashing on unhandled errors).
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    const message =
      typeof err?.message === "string" && err.message.length > 0
        ? err.message
        : "Internal Server Error";

    // Multer + validation issues should be 400 (not 500)
    const statusCode =
      message.includes(".xlsx") || message.toLowerCase().includes("file")
        ? 400
        : 500;

    res.status(statusCode).json({ message });
  });

  return app;
}

