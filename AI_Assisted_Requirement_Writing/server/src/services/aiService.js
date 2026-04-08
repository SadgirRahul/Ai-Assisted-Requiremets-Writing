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
  const domainValue = typeof domain === "string" && domain.trim().length > 0 ? domain.trim() : "unspecified";

  return {
    system: `You are a senior software requirements analyst with 15 years of experience 
writing IEEE-standard software requirement specifications.

Given a raw project description, extract and generate structured software 
requirements with these strict rules:

CLASSIFICATION RULES:
- Functional Requirements = WHAT the system does (features, user actions, 
  system behaviors)
- Non-Functional Requirements = HOW the system performs (speed, security, 
  availability, usability, scalability)
- NEVER classify security, validation, performance, or availability as 
  functional requirements
- If the input mentions "data security" or "protect information" → always 
  NFR under Security category
- If the input mentions "validate input" or "error messages" → always NFR 
  under Data Validation category
- If the input mentions "load quickly" or "respond fast" → always NFR under 
  Performance with a specific measurable threshold

DESCRIPTION RULES — every requirement description must:
- Be specific and testable, never vague
- Replace vague words with measurable values:
  "fast" → "within 2 seconds"
  "many users" → "minimum 500 concurrent users"  
  "available 24/7" → "99.9% uptime per calendar month"
  "secure" → specific encryption standard (TLS 1.2, bcrypt 12 rounds)
  "easy to use" → "WCAG 2.1 AA compliant"
- Start with the subject (The system / Students / Faculty / Admin)
- Include a measurable success condition at the end

CATEGORY RULES for Functional:
- Authentication, Student Services, Faculty Services, User Management, 
  Search, Notifications, UI, Reporting
- Choose the most specific category that fits

CATEGORY RULES for Non-Functional:
- Performance, Security, Availability, Usability, Scalability, 
  Data Validation, Maintainability, Reliability
- Never use generic category names

PRIORITY RULES:
- HIGH = system cannot launch without this feature
- MEDIUM = important but can be deferred to v1.1
- LOW = nice to have, does not affect core functionality

QUANTITY:
- Generate 8-12 functional requirements
- Generate 4-8 non-functional requirements
- Do not repeat the same idea twice with different wording

Domain context provided: ${domainValue}

Return ONLY valid JSON, no markdown, no explanation:
{
  "functional": [
    { 
      "id": "FR-1", 
      "description": "...", 
      "priority": "HIGH|MEDIUM|LOW", 
      "category": "..." 
    }
  ],
  "nonFunctional": [
    { 
      "id": "NFR-1", 
      "description": "...", 
      "priority": "HIGH|MEDIUM|LOW", 
      "category": "..." 
    }
  ]
}`,

    user: `Analyze the following project description and return JSON only.

Project description:
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

  const normalizePriorityLabel = (value) => {
    const p = String(value || "").trim().toUpperCase();
    if (p === "HIGH") return "High";
    if (p === "MEDIUM") return "Medium";
    if (p === "LOW") return "Low";
    return "Medium";
  };

  const normalizeReq = (r = {}, fallbackId) => ({
    id: String(r.id || fallbackId || "").trim(),
    description: String(r.description || "").trim(),
    priority: normalizePriorityLabel(r.priority),
    category: String(r.category || "General").trim() || "General",
  });

  // Accept both old and new JSON shapes from the model.
  const functionalRaw = Array.isArray(parsed.functional_requirements)
    ? parsed.functional_requirements
    : Array.isArray(parsed.functional)
      ? parsed.functional
      : [];
  const nonFunctionalRaw = Array.isArray(parsed.non_functional_requirements)
    ? parsed.non_functional_requirements
    : Array.isArray(parsed.nonFunctional)
      ? parsed.nonFunctional
      : [];

  const functional = functionalRaw.map((r, i) => normalizeReq(r, `FR-${i + 1}`));
  const nonFunctional = nonFunctionalRaw.map((r, i) => normalizeReq(r, `NFR-${i + 1}`));

  const before = {
    functional_requirements: functional.map((r) => ({ ...r })),
    non_functional_requirements: nonFunctional.map((r) => ({ ...r })),
  };

  const hasAny = (text, patterns) => patterns.some((re) => re.test(text));
  const hasTimeValue = (text) =>
    /\b\d+(\.\d+)?\s*(ms|millisecond|milliseconds|s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i.test(
      text
    );
  const hasNumber = (text) => /\b\d+\b/.test(text);
  const hasPercent = (text) => /\b\d+(\.\d+)?\s*%\b/.test(text);
  const hasSecurityStandard = (text) =>
    /\b(tls\s*1\.[0-3]|ssl|bcrypt|aes-?\d*|sha-?\d*|argon2|scrypt|oauth|jwt|saml|mfa|2fa)\b/i.test(
      text
    );

  const descriptionPat = {
    security: [/\bencrypt\b/i, /\bhash\b/i, /\btls\b/i, /\bbcrypt\b/i, /\bpassword storage\b/i],
    performance: [/\bresponse time\b/i, /\bload time\b/i, /\bconcurrent users?\b/i],
    availability: [/\buptime\b/i],
  };

  const categoryNorm = (v) => String(v || "").trim().toLowerCase();
  const functionalOut = [];
  const nonFunctionalOut = [...nonFunctional];
  let movedCount = 0;

  functional.forEach((req) => {
    const desc = String(req.description || "");
    const c = categoryNorm(req.category);

    const isSecurity =
      c === "security" || hasAny(desc, descriptionPat.security);
    const isPerformance =
      c === "performance" || hasAny(desc, descriptionPat.performance);
    const isDataValidation = c === "data validation";
    const isAvailability = c === "availability" || hasAny(desc, descriptionPat.availability);

    if (isSecurity) {
      nonFunctionalOut.push({ ...req, category: "Security" });
      movedCount++;
      return;
    }
    if (isPerformance) {
      nonFunctionalOut.push({ ...req, category: "Performance" });
      movedCount++;
      return;
    }
    if (isDataValidation) {
      nonFunctionalOut.push({ ...req, category: "Data Validation" });
      movedCount++;
      return;
    }
    if (isAvailability) {
      nonFunctionalOut.push({ ...req, category: "Availability" });
      movedCount++;
      return;
    }
    functionalOut.push(req);
  });

  const autoFixVagueness = (req) => {
    const desc = String(req.description || "");
    const append = [];

    if (/\bquickly\b/i.test(desc) && !hasTimeValue(desc)) {
      append.push("(target: within 2 seconds)");
    }
    if (/\bmultiple users\b/i.test(desc) && !hasNumber(desc)) {
      append.push("(minimum: 500 concurrent users)");
    }
    if (/\b24\/7\b/i.test(desc) && !hasPercent(desc)) {
      append.push("(target: 99.9% monthly uptime)");
    }
    if (/\b(secure|safely)\b/i.test(desc) && !hasSecurityStandard(desc)) {
      append.push("(using TLS 1.2+ and bcrypt)");
    }

    if (append.length === 0) return req;
    return { ...req, description: `${desc} ${append.join(" ")}`.trim() };
  };

  const finalFunctional = functionalOut.map(autoFixVagueness).map((r, i) => ({
    ...r,
    id: `FR-${i + 1}`,
  }));
  const finalNonFunctional = nonFunctionalOut.map(autoFixVagueness).map((r, i) => ({
    ...r,
    id: `NFR-${i + 1}`,
  }));

  const measurablePatterns = [
    /\b\d+(\.\d+)?\s*(ms|millisecond|milliseconds|s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i,
    /\b\d+(\.\d+)?\s*%\b/,
    /\b\d+\s*concurrent users?\b/i,
    /\b(tls\s*1\.[0-3]|bcrypt|aes-?\d*|sha-?\d*|wcag\s*2\.1\s*aa)\b/i,
  ];
  const isMeasurable = (desc = "") => measurablePatterns.some((re) => re.test(String(desc)));

  const combinedFinal = [...finalFunctional, ...finalNonFunctional];
  const qualityReport = {
    totalGenerated: combinedFinal.length,
    autoCorrections: movedCount,
    measurableCount: combinedFinal.filter((r) => isMeasurable(r.description)).length,
    correctlyClassified: Math.max(0, combinedFinal.length - movedCount),
  };

  const after = {
    functional_requirements: finalFunctional,
    non_functional_requirements: finalNonFunctional,
    functional: finalFunctional,
    nonFunctional: finalNonFunctional,
    qualityReport,
  };

  console.log("[aiService] Requirements BEFORE correction:", JSON.stringify(before, null, 2));
  console.log("[aiService] Requirements AFTER correction:", JSON.stringify(after, null, 2));

  return after;
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
