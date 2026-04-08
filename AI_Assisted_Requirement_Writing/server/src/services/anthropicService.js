const axios = require("axios");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "60000");
const MAX_TEXT_LENGTH = parseInt(process.env.AI_MAX_TEXT_LENGTH || "12000");

function validateConfig() {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }
}

function normalizePriority(raw) {
  const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v;
  return null;
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function stripJsonFences(text) {
  if (typeof text !== "string") return "";
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function parseJsonOrThrow(text) {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("LLM returned invalid JSON. Please try again.");
  }
}

function buildPrompt(extractedText, domain) {
  const truncated =
    extractedText.length > MAX_TEXT_LENGTH
      ? `${extractedText.slice(0, MAX_TEXT_LENGTH)}\n...[truncated]`
      : extractedText;

  const domainLine =
    typeof domain === "string" && domain.trim().length > 0
      ? `Domain: ${domain.trim()}`
      : "Domain: (unspecified)";

  return `${domainLine}
You are an expert requirements engineer. Extract structured software requirements from the document below.

Return ONLY valid JSON in this exact structure (no markdown, no commentary):
{
  "functional": [
    { "id": "FR-1", "description": "...", "priority": "HIGH", "category": "..." }
  ],
  "nonFunctional": [
    { "id": "NFR-1", "description": "...", "priority": "MEDIUM", "category": "..." }
  ]
}

Rules:
- "priority" must be exactly one of: HIGH, MEDIUM, LOW
- ids must be FR-1, FR-2... for functional and NFR-1, NFR-2... for nonFunctional
- Keep each description specific and testable

Document:
${truncated}`;
}

function coerceShape(parsed) {
  const functional = ensureArray(parsed?.functional).map((r) => ({
    id: typeof r?.id === "string" ? r.id : "",
    description: typeof r?.description === "string" ? r.description : "",
    priority: normalizePriority(r?.priority) || "MEDIUM",
    category: typeof r?.category === "string" ? r.category : "General",
  }));

  const nonFunctional = ensureArray(parsed?.nonFunctional).map((r) => ({
    id: typeof r?.id === "string" ? r.id : "",
    description: typeof r?.description === "string" ? r.description : "",
    priority: normalizePriority(r?.priority) || "MEDIUM",
    category: typeof r?.category === "string" ? r.category : "General",
  }));

  return { functional, nonFunctional };
}

/**
 * Generate requirements using Anthropic Claude.
 * @param {string} extractedText
 * @param {{ domain?: string }} [options]
 * @returns {Promise<{functional: Array, nonFunctional: Array}>}
 */
async function generateRequirementsAnthropic(extractedText, options = {}) {
  validateConfig();
  const domain = typeof options.domain === "string" ? options.domain : "";
  const prompt = buildPrompt(extractedText || "", domain);

  let response;
  try {
    response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      }
    );
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const detail =
        err.response.data?.error?.message ||
        err.response.data?.error ||
        err.response.statusText;
      throw new Error(`Anthropic API error (${status}): ${detail}`);
    }
    if (err.code === "ECONNABORTED") {
      throw new Error(`Anthropic request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw new Error(`Failed to connect to Anthropic: ${err.message}`);
  }

  const contentBlocks = response.data?.content;
  const firstText = Array.isArray(contentBlocks)
    ? contentBlocks.find((b) => b?.type === "text")?.text
    : null;

  if (!firstText || typeof firstText !== "string") {
    throw new Error("Anthropic returned an empty response");
  }

  const parsed = parseJsonOrThrow(firstText);
  return coerceShape(parsed);
}

module.exports = { generateRequirementsAnthropic };

