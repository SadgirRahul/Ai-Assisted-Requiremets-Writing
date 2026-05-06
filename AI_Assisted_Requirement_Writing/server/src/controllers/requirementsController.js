const { parseFile } = require("../services/fileParser");
const { generateRequirements, detectDomain } = require("../services/aiService");
const { generateRequirementsAnthropic } = require("../services/anthropicService");
const { enrichRequirementsWithQuality } = require("../services/qualityService");
const { detectDuplicateGroups } = require("../services/duplicateService");

const DOMAIN_ID_MAP = {
  healthcare: "healthcare",
  finance: "finance",
  ecommerce: "ecommerce",
  education: "education",
  technology: "technology",
  custom: "custom",
};

const normalizeDomainId = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const mapDetectedDomainToId = (detected = "") => {
  const n = normalizeDomainId(detected);
  if (n.includes("health")) return DOMAIN_ID_MAP.healthcare;
  if (n.includes("finance")) return DOMAIN_ID_MAP.finance;
  if (n.includes("education")) return DOMAIN_ID_MAP.education;
  if (n.includes("ecommerce") || n.includes("commerce") || n.includes("retail")) {
    return DOMAIN_ID_MAP.ecommerce;
  }
  if (n.includes("technology") || n.includes("saas") || n.includes("software")) {
    return DOMAIN_ID_MAP.technology;
  }
  return DOMAIN_ID_MAP.custom;
};

const confidenceToScore = (confidence = "low") => {
  const c = String(confidence || "").toLowerCase();
  if (c === "high") return 91;
  if (c === "medium") return 78;
  return 62;
};

const buildDuplicateMetadata = (requirements) => {
  const functional = Array.isArray(requirements.functional_requirements)
    ? requirements.functional_requirements
    : [];
  const nonFunctional = Array.isArray(requirements.non_functional_requirements)
    ? requirements.non_functional_requirements
    : [];

  const combined = [...functional, ...nonFunctional];
  const groups = detectDuplicateGroups(combined, 0.7).map((group, idx) => ({
    groupId: `dup-${idx + 1}`,
    items: group.map((item) => ({
      id: item.id,
      description: item.description,
      priority: item.priority,
      category: item.category,
      similarity: typeof item.similarity === "number" ? item.similarity : undefined,
    })),
  }));

  const duplicatesFound = groups.reduce((sum, g) => sum + g.items.length, 0);

  return {
    duplicatesFound,
    groups,
  };
};

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
 * POST /api/detect-domain
 * Upload file and return detected domain + confidence.
 */
const detectDomainFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const text = await parseFile(req.file);
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "No text could be extracted from the file" });
    }

    const detection = await detectDomain(text);
    const detectedDomainId = mapDetectedDomainToId(detection.detectedDomain);

    return res.json({
      detectedDomainId,
      detectedDomainLabel: detection.detectedDomain,
      confidence: detection.confidence,
      confidenceScore: confidenceToScore(detection.confidence),
      reason: detection.reason,
    });
  } catch (error) {
    console.error("[detectDomainFromFile] Error:", error.message);
    return res.status(isUpstreamLlmError(error.message) ? 503 : 500).json({
      error: error.message || "Failed to detect domain",
    });
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

    const domain = typeof req.body.domain === "string" ? req.body.domain.trim() : "";

    // Step 1: extraction service (same logic as /api/extract-text)
    const text = await parseFile(req.file);
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "No text could be extracted from the file" });
    }

    let effectiveDomain = domain;
    let autoDetection = null;

    if (!effectiveDomain) {
      const detected = await detectDomain(text);
      const detectedDomainId = mapDetectedDomainToId(detected.detectedDomain);
      effectiveDomain = detectedDomainId === DOMAIN_ID_MAP.custom ? "" : detectedDomainId;
      autoDetection = {
        detectedDomainId,
        detectedDomainLabel: detected.detectedDomain,
        confidence: detected.confidence,
        confidenceScore: confidenceToScore(detected.confidence),
        reason: detected.reason,
      };
    }

    // Step 2: LLM service (Anthropic)
    // LLM service: OpenRouter (matches the existing UI expectations)
    const rawRequirements = await generateRequirements(text, { domain: effectiveDomain });
    const requirementsWithQuality = enrichRequirementsWithQuality(rawRequirements);
    const duplicates = buildDuplicateMetadata(requirementsWithQuality);
    const requirements = {
      ...requirementsWithQuality,
      duplicates,
    };

    // Step 3: return final requirements JSON
    return res.json({
      domain: effectiveDomain || null,
      autoDetection,
      requirements,
    });
  } catch (error) {
    console.error("[generateRequirementsMain] Error:", error.message);
    const status = isUpstreamLlmError(error.message) ? 503 : 500;
    return res.status(status).json({ error: error.message || "Internal server error" });
  }
};

/**
 * POST /api/analyze-developer
 * Accepts array of requirements and domain, returns developer analysis (tasks, tech stack, complexity)
 */
const analyzeDeveloper = async (req, res) => {
  try {
    const axios = require("axios");
    const apiKey = process.env.OPENROUTER_API_KEY;
    const modelName = process.env.OPENROUTER_MODEL || "qwen/qwen3-8b";

    console.log("API KEY FOUND:", apiKey ? "YES" : "NO");
    console.log("KEY STARTS WITH:", apiKey ? apiKey.substring(0, 15) : "NOTHING");

    const body = req.body || {};
    const requirements = body.requirements || [];
    const domain = body.domain || "General";

    if (!Array.isArray(requirements)) {
      return res.status(400).json({ error: "`requirements` must be an array" });
    }

    if (!apiKey) {
      return res.status(503).json({ error: "OPENROUTER_API_KEY is not configured" });
    }

    const results = [];

    for (const req of requirements) {
      if (typeof req !== "object" || !req) continue;
      if (String(req.type || "").toLowerCase() !== "functional") continue;

      const prompt = `You are a senior software engineer.
Requirement: ${req.description || ""}
Domain: ${domain}

Respond with raw JSON only. No markdown. No code blocks.
Start directly with open curly brace.

{
  "tasks": [
    "Task 1",
    "Task 2", 
    "Task 3",
    "Task 4",
    "Task 5"
  ],
  "tech_stack": {
    "frontend": ["React", "Tailwind CSS"],
    "backend": ["Node.js", "Express"],
    "database": ["MongoDB"],
    "other": ["JWT"]
  },
  "complexity": {
    "level": "Medium",
    "score": 6,
    "reason": "Reason here",
    "estimated_hours": 12
  }
}`;

      try {
        const response = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: modelName,
            messages: [{ role: "user", content: prompt }],
          },
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "AI Requirements Tool",
            },
            timeout: 30000,
          }
        );

        console.log("STATUS CODE:", response.status);

        if (response.status !== 200) {
          console.log("ERROR:", response.statusText);
          continue;
        }

        let raw = response.data?.choices?.[0]?.message?.content || "";
        console.log("RAW RESPONSE:", raw.substring(0, 300));

        raw = raw.trim();
        raw = raw.replace(/^```json\s*/, "");
        raw = raw.replace(/^```\s*/, "");
        raw = raw.replace(/```$/, "");
        raw = raw.trim();

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          console.log("PARSE FAILED:", e.message);
          console.log("FULL RAW:", raw);
          parsed = {
            tasks: [],
            tech_stack: {
              frontend: [],
              backend: [],
              database: [],
              other: [],
            },
            complexity: {
              level: "Medium",
              score: 5,
              reason: "Parse failed",
              estimated_hours: 0,
            },
          };
        }

        results.push({
          id: req.id || "",
          description: req.description || "",
          tasks: parsed.tasks || [],
          tech_stack: parsed.tech_stack || {},
          complexity: parsed.complexity || {},
        });
      } catch (err) {
        console.log("REQUEST FAILED FOR", req.id, ":", err.message);
      }
    }

    return res.json(results);
  } catch (error) {
    console.error("[analyzeDeveloper] Error:", error.message);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

module.exports = {
  health,
  extractText,
  detectDomainFromFile,
  uploadFile,
  uploadAndGenerate,
  uploadAndGenerateAnthropic,
  generateRequirementsMain,
  analyzeDeveloper,
};
