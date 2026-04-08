const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  health,
  extractText,
  uploadFile,
  uploadAndGenerate,
  uploadAndGenerateAnthropic,
  generateRequirementsMain,
} = require("../controllers/requirementsController");

// GET /api/health - Quick health check
router.get("/health", health);

// POST /api/extract-text - Upload file and return extracted raw text
router.post("/extract-text", upload.single("file"), extractText);

// POST /api/upload - Upload file and return extracted text
router.post("/upload", upload.single("file"), uploadFile);

// POST /api/generate - Upload file and generate AI requirements
router.post("/generate", upload.single("file"), uploadAndGenerate);

// POST /api/generate-anthropic - Upload file and generate requirements via Anthropic Claude
router.post("/generate-anthropic", upload.single("file"), uploadAndGenerateAnthropic);

// POST /api/generate-requirements - Main endpoint (extract text + generate requirements)
router.post("/generate-requirements", upload.single("file"), generateRequirementsMain);

module.exports = router;
