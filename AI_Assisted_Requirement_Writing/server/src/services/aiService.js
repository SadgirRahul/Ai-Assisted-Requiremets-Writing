const axios = require("axios");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const stripWrappingQuotes = (value = "") =>
  value.replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1");

const sanitizeToken = (value = "") => String(value).replace(/[^A-Za-z0-9._-]/g, "");

const maskKey = (key = "") => {
  if (!key) return "<empty>";
  if (key.length <= 12) return `${key.slice(0, 2)}***${key.slice(-2)} (len=${key.length})`;
  return `${key.slice(0, 8)}...${key.slice(-6)} (len=${key.length})`;
};

const getConfig = () => {
  // Read server/.env directly to avoid stale/overridden machine-level env vars.
  const envPath = path.resolve(__dirname, "../../.env");
  let fileEnv = {};
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    fileEnv = dotenv.parse(raw);
  } catch {
    fileEnv = {};
  }

  const pick = (key, fallback = "") =>
    fileEnv[key] !== undefined ? fileEnv[key] : (process.env[key] ?? fallback);

  const openrouterApiUrl =
    pick("OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions").trim();
  const openrouterApiKey = sanitizeToken(
    stripWrappingQuotes(String(pick("OPENROUTER_API_KEY", "")).trim())
  );
  const openrouterModel = String(pick("OPENROUTER_MODEL", "")).trim();
  const openrouterSiteUrl = String(pick("OPENROUTER_SITE_URL", "")).trim();
  const openrouterSiteName = String(
    pick("OPENROUTER_SITE_NAME", "AI Requirements Generator")
  ).trim();

  const requestTimeoutMs = parseInt(String(pick("AI_REQUEST_TIMEOUT_MS", "60000")));
  const maxTextLength = parseInt(String(pick("AI_MAX_TEXT_LENGTH", "12000")));
  const temperature = parseFloat(String(pick("AI_TEMPERATURE", "0.2")));

  return {
    openrouterApiUrl,
    openrouterApiKey,
    openrouterModel,
    openrouterSiteUrl,
    openrouterSiteName,
    requestTimeoutMs,
    maxTextLength,
    temperature,
  };
};

/**
 * Validates that all required environment variables are set.
 */
const validateConfig = (cfg) => {
  if (!cfg.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }
  if (!cfg.openrouterModel) {
    throw new Error("OPENROUTER_MODEL is not set in environment variables");
  }
};

/**
 * Builds the system prompt for requirements extraction.
 * @param {string} text
 * @param {{ domain?: string }} [options]
 */
const buildPrompt = (text, options = {}) => {
  const { domain } = options;
  const cfg = getConfig();
  // Truncate text if too long to avoid token limits
  const truncated =
    text.length > cfg.maxTextLength ? text.slice(0, cfg.maxTextLength) + "\n...[truncated]" : text;

  const domainContext =
    domain && domain.length > 0
      ? `\n\nIndustry / domain context (use appropriate terminology and categories): ${domain}`
      : "";

  return {
    system: `You are an expert requirements engineer. Your task is to analyze documents and extract structured software requirements.
Always return ONLY valid JSON matching the exact schema provided. Do not include any explanation or markdown.`,

    user: `Analyze the following document and extract all software requirements.${domainContext}

Return ONLY a valid JSON object with this exact structure:
{
  "functional_requirements": [
    {
      "id": "FR-1",
      "description": "Clear description of what the system must do",
      "priority": "High",
      "category": "Authentication"
    }
  ],
  "non_functional_requirements": [
    {
      "id": "NFR-1",
      "description": "Clear description of quality attribute or constraint",
      "priority": "Medium",
      "category": "Performance"
    }
  ]
}

Rules:
- "priority" must be one of: "High", "Medium", "Low"
- "id" must follow pattern: FR-1, FR-2... for functional; NFR-1, NFR-2... for non-functional
- "category" should describe the domain (e.g. Authentication, UI, Security, Performance, Scalability)
- Extract ALL requirements you can find — be thorough
- Return only the JSON object, nothing else

Document:
${truncated}`,
  };
};

/**
 * Parses the AI response and ensures it matches the expected schema.
 */
const parseAIResponse = (content) => {
  let parsed;

  try {
    // Strip markdown code blocks if present
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  // Ensure expected keys exist
  if (!Array.isArray(parsed.functional_requirements)) {
    parsed.functional_requirements = [];
  }
  if (!Array.isArray(parsed.non_functional_requirements)) {
    parsed.non_functional_requirements = [];
  }

  return parsed;
};

/**
 * Sends extracted document text to OpenRouter LLM and returns structured requirements.
 * @param {string} text - Extracted plain text from the uploaded document
 * @param {{ domain?: string }} [options]
 * @returns {Promise<{functional_requirements: Array, non_functional_requirements: Array}>}
 */
const generateRequirements = async (text, options = {}) => {
  const cfg = getConfig();
  validateConfig(cfg);

  const { system, user } = buildPrompt(text, options);

  console.log(`[aiService] Sending request to OpenRouter — model: ${cfg.openrouterModel}`);
  console.log(`[aiService] Text length: ${text.length} chars (max: ${cfg.maxTextLength})`);
  console.log(`[aiService] Key fingerprint: ${maskKey(cfg.openrouterApiKey)}`);

  let response;
  try {
    response = await axios.post(
      cfg.openrouterApiUrl,
      {
        model: cfg.openrouterModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: cfg.temperature,
        response_format: { type: "json_object" },
      },
      {
        timeout: cfg.requestTimeoutMs,
        headers: {
          Authorization: `Bearer ${cfg.openrouterApiKey}`,
          "Content-Type": "application/json",
          ...(cfg.openrouterSiteUrl && { "HTTP-Referer": cfg.openrouterSiteUrl }),
          ...(cfg.openrouterSiteName && { "X-Title": cfg.openrouterSiteName }),
        },
      }
    );
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const detail = err.response.data?.error?.message || err.response.statusText;
      throw new Error(`OpenRouter API error (${status}): ${detail}`);
    }
    if (err.code === "ECONNABORTED") {
      throw new Error(`OpenRouter request timed out after ${cfg.requestTimeoutMs / 1000}s`);
    }
    throw new Error(`Failed to connect to OpenRouter: ${err.message}`);
  }

  const choice = response.data?.choices?.[0];
  if (!choice) {
    throw new Error("OpenRouter returned an empty response");
  }

  const content = choice.message?.content;
  if (!content) {
    throw new Error("OpenRouter response has no content");
  }

  const requirements = parseAIResponse(content);

  console.log(
    `[aiService] Success — FR: ${requirements.functional_requirements.length}, NFR: ${requirements.non_functional_requirements.length}`
  );

  return requirements;
};

module.exports = { generateRequirements };
