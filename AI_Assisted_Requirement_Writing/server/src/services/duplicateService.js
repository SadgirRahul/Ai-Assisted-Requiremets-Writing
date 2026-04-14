const tokenize = (text = "") =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !new Set(["the", "a", "an", "and", "or", "to", "of", "for", "with", "in", "on", "shall", "must", "will"]).has(w));

const toVector = (tokens) => {
  const vec = new Map();
  tokens.forEach((t) => vec.set(t, (vec.get(t) || 0) + 1));
  return vec;
};

const cosineSimilarity = (aText = "", bText = "") => {
  const aVec = toVector(tokenize(aText));
  const bVec = toVector(tokenize(bText));

  if (aVec.size === 0 || bVec.size === 0) return 0;

  let dot = 0;
  for (const [token, aVal] of aVec.entries()) {
    const bVal = bVec.get(token) || 0;
    dot += aVal * bVal;
  }

  const magA = Math.sqrt(Array.from(aVec.values()).reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(Array.from(bVec.values()).reduce((sum, v) => sum + v * v, 0));

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
};

const detectDuplicateGroups = (requirements = [], threshold = 0.7) => {
  const groups = [];
  const visited = new Set();

  for (let i = 0; i < requirements.length; i++) {
    if (visited.has(i)) continue;
    const base = requirements[i];
    const group = [base];

    for (let j = i + 1; j < requirements.length; j++) {
      if (visited.has(j)) continue;
      const sim = cosineSimilarity(base.description || "", requirements[j].description || "");
      if (sim >= threshold) {
        group.push({ ...requirements[j], similarity: Math.round(sim * 100) / 100 });
        visited.add(j);
      }
    }

    if (group.length > 1) {
      groups.push(group);
      visited.add(i);
    }
  }

  return groups;
};

module.exports = {
  cosineSimilarity,
  detectDuplicateGroups,
};
