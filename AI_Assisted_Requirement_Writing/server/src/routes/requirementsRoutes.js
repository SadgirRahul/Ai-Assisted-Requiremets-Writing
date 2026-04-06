const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { uploadFile, uploadAndGenerate } = require("../controllers/requirementsController");

// POST /api/upload - Upload file and return extracted text
router.post("/upload", upload.single("file"), uploadFile);

// POST /api/generate - Upload file and generate AI requirements
router.post("/generate", upload.single("file"), uploadAndGenerate);

module.exports = router;
