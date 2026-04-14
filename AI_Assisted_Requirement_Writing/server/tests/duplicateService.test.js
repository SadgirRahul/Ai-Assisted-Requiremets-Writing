const test = require("node:test");
const assert = require("node:assert/strict");

const { cosineSimilarity, detectDuplicateGroups } = require("../src/services/duplicateService");

test("cosineSimilarity is high for semantically close requirement text", () => {
  const a = "The system shall encrypt user data at rest and in transit.";
  const b = "User data shall be encrypted in transit and at rest by the system.";
  const sim = cosineSimilarity(a, b);
  assert.ok(sim > 0.6);
});

test("detectDuplicateGroups groups near-duplicate requirements", () => {
  const reqs = [
    { id: "R1", description: "The system shall send email notifications to users." },
    { id: "R2", description: "Users shall receive email notifications from the system." },
    { id: "R3", description: "The app shall support dark mode for dashboard." },
  ];

  const groups = detectDuplicateGroups(reqs, 0.6);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 2);
});
