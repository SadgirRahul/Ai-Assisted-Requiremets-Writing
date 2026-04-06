const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const requirementsRoutes = require("./routes/requirementsRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Middleware
app.use(cors({ origin: CLIENT_URL }));
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
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

// MongoDB connection (optional)
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${CLIENT_URL}`);
});
