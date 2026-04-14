const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectAmbiguity,
  computeCompletenessScorecard,
  enrichRequirementsWithQuality,
} = require("../src/services/qualityService");

test("detectAmbiguity flags vague language and suggests measurable rewrite", () => {
  const result = detectAmbiguity("The system shall be fast and user-friendly.");
  assert.equal(result.isAmbiguous, true);
  assert.ok(result.ambiguousTerms.includes("fast"));
  assert.ok(result.suggestedRewrite.length > 10);
});

test("enrichRequirementsWithQuality adds ambiguity and scorecard", () => {
  const base = {
    functional_requirements: [
      { id: "FR-1", description: "The system shall create an account within 2 seconds.", priority: "High", category: "User Management" },
    ],
    non_functional_requirements: [
      { id: "NFR-1", description: "The system shall be secure.", priority: "High", category: "Security" },
    ],
  };

  const out = enrichRequirementsWithQuality(base);
  assert.equal(out.functional_requirements.length, 1);
  assert.equal(out.non_functional_requirements.length, 1);
  assert.equal(typeof out.qualityScorecard.overall, "number");
  assert.ok(out.non_functional_requirements[0].ambiguity.isAmbiguous);
});

test("computeCompletenessScorecard returns stable 0-100 values", () => {
  const score = computeCompletenessScorecard({
    functional: [
      {
        description: "The system shall process 100 requests per minute.",
        qualitySignals: { testable: true, specific: true, unambiguous: true },
      },
    ],
    nonFunctional: [
      {
        description: "The application should be user-friendly.",
        qualitySignals: { testable: false, specific: true, unambiguous: false },
      },
    ],
  });

  assert.ok(score.overall >= 0 && score.overall <= 100);
  assert.ok(score.breakdown.coverage >= 0 && score.breakdown.coverage <= 100);
});
