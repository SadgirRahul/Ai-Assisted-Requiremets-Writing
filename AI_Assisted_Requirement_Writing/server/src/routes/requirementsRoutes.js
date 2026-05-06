const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  health,
  extractText,
  detectDomainFromFile,
  uploadFile,
  uploadAndGenerate,
  uploadAndGenerateAnthropic,
  generateRequirementsMain,
  analyzeDeveloper,
} = require("../controllers/requirementsController");

// GET /api/health - Quick health check
router.get("/health", health);

// POST /api/extract-text - Upload file and return extracted raw text
router.post("/extract-text", upload.single("file"), extractText);

// POST /api/detect-domain - Upload file and auto-detect likely domain
router.post("/detect-domain", upload.single("file"), detectDomainFromFile);

// POST /api/upload - Upload file and return extracted text
router.post("/upload", upload.single("file"), uploadFile);

// POST /api/generate - Upload file and generate AI requirements
router.post("/generate", upload.single("file"), uploadAndGenerate);

// POST /api/generate-anthropic - Upload file and generate requirements via Anthropic Claude
router.post("/generate-anthropic", upload.single("file"), uploadAndGenerateAnthropic);

// POST /api/generate-requirements - Main endpoint (extract text + generate requirements)
router.post("/generate-requirements", upload.single("file"), generateRequirementsMain);

// POST /api/analyze-developer - Analyze requirements and return developer tasks/stack/complexity
router.post("/analyze-developer", analyzeDeveloper);

module.exports = router;
