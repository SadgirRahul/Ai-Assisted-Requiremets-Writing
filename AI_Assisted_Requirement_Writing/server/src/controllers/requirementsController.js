const { parseFile } = require("../services/fileParser");
const { generateRequirements } = require("../services/aiService");
const { generateRequirementsAnthropic } = require("../services/anthropicService");

const isUpstreamLlmError = (message = "") => {
  const m = String(message).toLowerCase();
  return (
    m.includes("anthropic") ||
    m.includes("openrouter") ||
    m.includes("api key") ||
    m.includes("timed out") ||
    m.includes("timeout") ||
    m.includes("rate") ||
    m.includes("429") ||
    m.includes("5") ||
    m.includes("connect")
  );
};

/**
 * POST /api/extract-text
 * Accepts PDF or Word file, extracts raw text, returns it as JSON.
 */
const extractText = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const text = await parseFile(req.file);
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "No text could be extracted from the file" });
    }

    return res.json({ text });
  } catch (error) {
    console.error("[extractText] Error:", error.message);
    // Parsing errors are user input problems (bad/unsupported docs), not server faults
    return res.status(400).json({ error: error.message || "Failed to extract text" });
  }
};

/**
 * GET /api/health
 * Simple API health check for frontends/monitors.
 */
const health = (req, res) => {
  res.json({ status: "ok" });
};

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

    const domain =
      typeof req.body.domain === "string" ? req.body.domain.trim() : "";

    // Step 2: Generate requirements using AI
    const requirements = await generateRequirements(extractedText, { domain });

    // Step 3: Return result
    res.json({
      success: true,
      filename: req.file.originalname,
      wordCount: extractedText.trim().split(/\s+/).length,
      domain: domain || null,
      requirements,
    });
  } catch (error) {
    console.error("[uploadAndGenerate] Error:", error.message);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * POST /api/generate-anthropic
 * Accepts PDF or Word file, extracts text, generates requirements using Anthropic Claude.
 */
const uploadAndGenerateAnthropic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const extractedText = await parseFile(req.file);
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "No text could be extracted from the file" });
    }

    const domain =
      typeof req.body.domain === "string" ? req.body.domain.trim() : "";

    const requirements = await generateRequirementsAnthropic(extractedText, { domain });

    return res.json({
      success: true,
      filename: req.file.originalname,
      wordCount: extractedText.trim().split(/\s+/).length,
      domain: domain || null,
      requirements,
    });
  } catch (error) {
    console.error("[uploadAndGenerateAnthropic] Error:", error.message);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

/**
 * POST /api/generate-requirements
 * Main endpoint: accepts file + domain, extracts text, generates requirements (Anthropic).
 */
const generateRequirementsMain = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const domain =
      typeof req.body.domain === "string" ? req.body.domain.trim() : "";

    // Step 1: extraction service (same logic as /api/extract-text)
    const text = await parseFile(req.file);
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "No text could be extracted from the file" });
    }

    // Step 2: LLM service (Anthropic)
    // LLM service: OpenRouter (matches the existing UI expectations)
    const requirements = await generateRequirements(text, { domain });

    // Step 3: return final requirements JSON
    return res.json({
      domain: domain || null,
      requirements,
    });
  } catch (error) {
    console.error("[generateRequirementsMain] Error:", error.message);
    const status = isUpstreamLlmError(error.message) ? 503 : 500;
    return res.status(status).json({ error: error.message || "Internal server error" });
  }
};

module.exports = {
  health,
  extractText,
  uploadFile,
  uploadAndGenerate,
  uploadAndGenerateAnthropic,
  generateRequirementsMain,
};
