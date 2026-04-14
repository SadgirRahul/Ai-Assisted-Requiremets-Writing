const VAGUE_PATTERNS = [
  {
    term: "fast",
    regex: /\b(fast|quick|quickly|rapid)\b/i,
    suggestion:
      "Response time shall not exceed 2 seconds for 95% of requests under normal load.",
  },
  {
    term: "user-friendly",
    regex: /\b(user[- ]?friendly|easy to use|intuitive)\b/i,
    suggestion:
      "At least 90% of first-time users shall complete the primary workflow without assistance within 3 minutes.",
  },
  {
    term: "secure",
    regex: /\b(secure|security|safe)\b/i,
    suggestion:
      "Sensitive data shall be encrypted in transit using TLS 1.2+ and at rest using AES-256.",
  },
  {
    term: "efficient",
    regex: /\b(efficient|optimized|optimal)\b/i,
    suggestion:
      "The system shall process 500 transactions per minute with CPU utilization below 70%.",
  },
  {
    term: "reliable",
    regex: /\b(reliable|robust|stable)\b/i,
    suggestion:
      "The system shall maintain 99.9% monthly uptime excluding planned maintenance.",
  },
];

const measurableRegexes = [
  /\b\d+(\.\d+)?\s*(ms|millisecond|milliseconds|s|sec|secs|second|seconds|min|mins|minute|minutes|hours?)\b/i,
  /\b\d+(\.\d+)?\s*%\b/i,
  /\b\d+\s*(users?|requests?|transactions?)\b/i,
  /\b(tls\s*1\.[0-3]|aes-?\d*|bcrypt|wcag\s*2\.1\s*aa|iso\s*27001)\b/i,
];

const testVerbRegex = /\b(shall|must|will)\b/i;

const isMeasurable = (description = "") =>
  measurableRegexes.some((re) => re.test(String(description || "")));

const isSpecific = (description = "") => {
  const d = String(description || "").trim();
  if (d.length < 30) return false;
  if (/\b(thing|stuff|etc|and so on|as needed)\b/i.test(d)) return false;
  return true;
};

const detectAmbiguity = (description = "") => {
  const d = String(description || "");
  const matches = VAGUE_PATTERNS.filter((p) => p.regex.test(d));
  const ambiguousTerms = matches.map((m) => m.term);

  if (ambiguousTerms.length === 0) {
    return {
      isAmbiguous: false,
      ambiguousTerms: [],
      suggestedRewrite: "",
      reason: "No vague language pattern detected.",
    };
  }

  const suggestedRewrite = matches[0].suggestion;
  return {
    isAmbiguous: true,
    ambiguousTerms,
    suggestedRewrite,
    reason: `Vague terms detected: ${ambiguousTerms.join(", ")}`,
  };
};

const enrichRequirement = (req = {}) => {
  const description = String(req.description || "").trim();
  const ambiguity = detectAmbiguity(description);
  const hasDirective = testVerbRegex.test(description);
  const measurable = isMeasurable(description);
  const specific = isSpecific(description);

  const qualitySignals = {
    testable: hasDirective && measurable,
    specific,
    unambiguous: !ambiguity.isAmbiguous,
  };

  return {
    ...req,
    ambiguity,
    qualitySignals,
  };
};

const percentage = (num, den) => (den <= 0 ? 0 : Math.round((num / den) * 100));

const computeCompletenessScorecard = ({ functional = [], nonFunctional = [] }) => {
  const all = [...functional, ...nonFunctional];
  const total = all.length;

  const testableCount = all.filter((r) => r.qualitySignals?.testable).length;
  const specificCount = all.filter((r) => r.qualitySignals?.specific).length;
  const unambiguousCount = all.filter((r) => r.qualitySignals?.unambiguous).length;

  const testabilityScore = percentage(testableCount, total);
  const specificityScore = percentage(specificCount, total);
  const clarityScore = percentage(unambiguousCount, total);

  let coverageScore = 0;
  if (functional.length > 0 && nonFunctional.length > 0) coverageScore = 100;
  else if (functional.length > 0 || nonFunctional.length > 0) coverageScore = 60;

  const overall = Math.round(
    testabilityScore * 0.3 + specificityScore * 0.25 + clarityScore * 0.25 + coverageScore * 0.2
  );

  return {
    overall,
    breakdown: {
      testability: testabilityScore,
      specificity: specificityScore,
      clarity: clarityScore,
      coverage: coverageScore,
    },
    counts: {
      total,
      functional: functional.length,
      nonFunctional: nonFunctional.length,
      ambiguous: total - unambiguousCount,
      testable: testableCount,
    },
  };
};

const enrichRequirementsWithQuality = (requirements = {}) => {
  const functionalSource = Array.isArray(requirements.functional_requirements)
    ? requirements.functional_requirements
    : Array.isArray(requirements.functional)
      ? requirements.functional
      : [];

  const nonFunctionalSource = Array.isArray(requirements.non_functional_requirements)
    ? requirements.non_functional_requirements
    : Array.isArray(requirements.nonFunctional)
      ? requirements.nonFunctional
      : [];

  const functional = functionalSource.map(enrichRequirement);
  const nonFunctional = nonFunctionalSource.map(enrichRequirement);

  const qualityScorecard = computeCompletenessScorecard({ functional, nonFunctional });

  return {
    ...requirements,
    functional_requirements: functional,
    non_functional_requirements: nonFunctional,
    functional,
    nonFunctional,
    qualityScorecard,
  };
};

module.exports = {
  detectAmbiguity,
  computeCompletenessScorecard,
  enrichRequirementsWithQuality,
};
