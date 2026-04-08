const dotenv = require("dotenv");
// Ensure local .env values override machine/user env vars in dev.
dotenv.config({ override: true });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const requirementsRoutes = require("./routes/requirementsRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

function isConfiguredMongoUri(uri) {
  return (
    typeof uri === "string" &&
    uri.length > 0 &&
    (uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"))
  );
}

/** Local dev origins (Vite may use 3001+ if 3000 is busy). CLIENT_URL can add more (comma-separated). */
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const extraFromEnv = (process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...DEFAULT_DEV_ORIGINS, ...extraFromEnv])];

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "AI Requirements Generator API is running",
    version: process.env.npm_package_version || "1.0.0",
    endpoints: {
      upload: "POST /api/upload  — Extract text from PDF/Word",
      generate: "POST /api/generate — Extract text + generate requirements",
    },
  });
});

// Routes
app.use("/api", requirementsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Global Error]", err.message);
  const status =
    err.status ||
    (err.name === "MulterError" ? 400 : 500);
  res.status(status).json({ error: err.message || "Internal server error" });
});

// MongoDB connection (optional — skip placeholders like .env examples)
if (isConfiguredMongoUri(MONGO_URI)) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(", ")}`);
});
