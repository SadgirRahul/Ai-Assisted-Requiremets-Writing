const { parseFile } = require("../services/fileParser");
const { generateRequirements } = require("../services/aiService");

/**
 * POST /api/upload
 * Accepts PDF or Word file, extracts text, returns it as JSON.
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const extractedText = await parseFile(req.file);

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "No text could be extracted from the file" });
    }

    res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      extractedText,
      wordCount: extractedText.trim().split(/\s+/).length,
    });
  } catch (error) {
    console.error("[uploadFile] Error:", error.message);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * POST /api/generate
 * Accepts PDF or Word file, extracts text, generates requirements using AI.
 */
const uploadAndGenerate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Step 1: Extract text from file
    const extractedText = await parseFile(req.file);

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "No text could be extracted from the file" });
    }

    // Step 2: Generate requirements using AI
    const requirements = await generateRequirements(extractedText);

    // Step 3: Return result
    res.json({
      success: true,
      filename: req.file.originalname,
      wordCount: extractedText.trim().split(/\s+/).length,
      requirements,
    });
  } catch (error) {
    console.error("[uploadAndGenerate] Error:", error.message);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

module.exports = { uploadFile, uploadAndGenerate };
