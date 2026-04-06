const axios = require("axios");

// All configuration from environment variables — no hardcoded values
const OPENROUTER_API_URL =
  process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || "";
const OPENROUTER_SITE_NAME = process.env.OPENROUTER_SITE_NAME || "AI Requirements Generator";
const REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "60000");
const MAX_TEXT_LENGTH = parseInt(process.env.AI_MAX_TEXT_LENGTH || "12000");
const TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || "0.2");

/**
 * Validates that all required environment variables are set.
 */
const validateConfig = () => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }
  if (!OPENROUTER_MODEL) {
    throw new Error("OPENROUTER_MODEL is not set in environment variables");
  }
};

/**
 * Builds the system prompt for requirements extraction.
 */
const buildPrompt = (text) => {
  // Truncate text if too long to avoid token limits
  const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) + "\n...[truncated]" : text;

  return {
    system: `You are an expert requirements engineer. Your task is to analyze documents and extract structured software requirements.
Always return ONLY valid JSON matching the exact schema provided. Do not include any explanation or markdown.`,

    user: `Analyze the following document and extract all software requirements.

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
 * @returns {Promise<{functional_requirements: Array, non_functional_requirements: Array}>}
 */
const generateRequirements = async (text) => {
  validateConfig();

  const { system, user } = buildPrompt(text);

  console.log(`[aiService] Sending request to OpenRouter — model: ${OPENROUTER_MODEL}`);
  console.log(`[aiService] Text length: ${text.length} chars (max: ${MAX_TEXT_LENGTH})`);

  let response;
  try {
    response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
      },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          ...(OPENROUTER_SITE_URL && { "HTTP-Referer": OPENROUTER_SITE_URL }),
          ...(OPENROUTER_SITE_NAME && { "X-Title": OPENROUTER_SITE_NAME }),
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
      throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
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
