import "dotenv/config";
import express from "express";
import cors from "cors";
import { join } from "path";
import reviewRouter from "./routes/review";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Trust proxy headers from Render
app.set("trust proxy", 1);

// CORS — allow Trello iframe origins
app.use(
  cors({
    origin: [
      "https://trello.com",
      "https://p.trellocdn.com",
      /\.trello\.com$/,
      // Allow localhost for development
      /^http:\/\/localhost(:\d+)?$/,
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "VetoCheck", version: "1.0.0" });
});

// API routes
app.use("/api/review", reviewRouter);

// Serve Power-Up static files last (catch-all)
const publicDir = join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Catch-all 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[server] Unhandled error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, () => {
  console.log(`VetoCheck server running on port ${PORT}`);
  console.log(`Power-Up static files served from: ${publicDir}`);
});

export default app;
