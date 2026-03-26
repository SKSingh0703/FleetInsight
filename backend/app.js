import express from "express";
import cors from "cors";
import morgan from "morgan";

import uploadRoutes from "./routes/uploadRoutes.js";
import apiRoutes from "./routes/index.js";

export default function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Phase 1 requirement: POST /upload (root path)
  app.use(uploadRoutes);

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

