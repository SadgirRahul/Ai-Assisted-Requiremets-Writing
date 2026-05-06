import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardList, Download, Maximize2, Minimize2, MousePointer2, X } from "lucide-react";
import Tree from "react-d3-tree";
import AnalysisDashboard from "./AnalysisDashboard";
import "./RequirementsOutput.css";

// Summary bar showing total FR + NFR counts and priority breakdown
const SummaryBar = ({ fr, nfr }) => {
  const all = [...fr, ...nfr];
  const counts = { High: 0, Medium: 0, Low: 0 };
  all.forEach((r) => {
    const p = r.priority || "";
    if (counts[p] !== undefined) counts[p]++;
  });

  return (
    <div className="summary-bar">
      <div className="summary-stat">
        <span className="summary-number">{all.length}</span>
        <span className="summary-label">Total</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-stat">
        <span className="summary-number">{fr.length}</span>
        <span className="summary-label">Functional</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-stat">
        <span className="summary-number">{nfr.length}</span>
        <span className="summary-label">Non-Functional</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-priorities">
        {Object.entries(counts).map(([level, count]) => (
          <span key={level} className={`priority-pill priority-${level.toLowerCase()}`}>
            {level}: {count}
          </span>
        ))}
      </div>
    </div>
  );
};

// Single requirements table with priority filter
const RequirementsTable = ({ items, title, accentColor }) => {
  const [filter, setFilter] = useState("All");
  const [expandedSuggestionKeys, setExpandedSuggestionKeys] = useState({});
  const [activeRequirement, setActiveRequirement] = useState(null);
  const priorities = ["All", "High", "Medium", "Low"];
  const filtered = filter === "All" ? items : items.filter((r) => r.priority === filter);

  const toggleSuggestion = (key) => {
    setExpandedSuggestionKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getRelevanceText = (req) => {
    const priority = String(req?.priority || "Medium").toLowerCase();
    const confidence = typeof req?.confidence === "number" ? req.confidence : 75;

    if (priority === "high" && confidence >= 80) {
      return "Core requirement with strong extraction confidence. Prioritize validation and implementation planning first.";
    }
    if (priority === "high") {
      return "Business-critical requirement. Keep it in immediate review scope before release planning.";
    }
    if (priority === "medium") {
      return "Important supporting requirement. Validate dependencies and confirm acceptance criteria.";
    }
    return "Lower-priority enhancement candidate. Useful for roadmap grooming after core scope is stable.";
  };

  const getImpactText = (req) => {
    const category = String(req?.category || "General");
    const ambiguous = !!req?.ambiguity?.isAmbiguous;
    const confidence = typeof req?.confidence === "number" ? req.confidence : null;

    if (ambiguous) {
      return `Potential implementation risk in ${category}: wording is ambiguous and may cause interpretation drift across teams.`;
    }
    if (typeof confidence === "number" && confidence < 70) {
      return `Moderate delivery impact in ${category}: low confidence indicates this requirement should be reviewed with stakeholders.`;
    }
    return `Positive delivery impact in ${category}: this requirement is suitable for clean traceability into design, test cases, and implementation.`;
  };

  const closeModal = () => setActiveRequirement(null);

  return (
    <div className="req-section">
      <div className="req-section-header">
        <div className="req-section-title">
          <span className="req-section-accent" style={{ background: accentColor }} />
          <h3>{title}</h3>
          <span className="badge" style={{ background: accentColor }}>{items.length}</span>
        </div>
        {items.length > 0 && (
          <div className="filter-pills">
            {priorities.map((p) => (
              <button
                key={p}
                className={`filter-pill ${filter === p ? "active" : ""}`}
                style={filter === p ? { borderColor: accentColor, color: accentColor } : {}}
                onClick={() => setFilter(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="no-data">No requirements found in this category.</p>
      ) : filtered.length === 0 ? (
        <p className="no-data">No {filter} priority requirements.</p>
      ) : (
        <div className="table-wrapper">
          <table className="req-table">
            <thead>
              <tr>
                <th style={{ width: "7%" }}>ID</th>
                <th style={{ width: "52%" }}>Description</th>
                <th style={{ width: "13%" }}>Priority</th>
                <th style={{ width: "28%" }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, idx) => (
                <tr
                  key={req.id || idx}
                  className={`${idx % 2 === 0 ? "row-even" : "row-odd"} req-row-clickable`}
                  onClick={() => setActiveRequirement(req)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveRequirement(req);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open details for ${req.id || `requirement ${idx + 1}`}`}
                >
                  <td><span className="req-id">{req.id || `#${idx + 1}`}</span></td>
                  <td className="req-description">
                    <div className="req-description-wrap">
                      <span>{req.description}</span>
                      {req.ambiguity?.isAmbiguous ? (
                        <button
                          type="button"
                          className="ambiguity-warning-btn"
                          title={req.ambiguity.reason || "Ambiguous wording detected"}
                          onClick={() => toggleSuggestion(`${req.id || idx}`)}
                        >
                          <AlertTriangle size={14} />
                        </button>
                      ) : null}
                    </div>
                    {req.ambiguity?.isAmbiguous && expandedSuggestionKeys[`${req.id || idx}`] ? (
                      <div className="ambiguity-suggestion">
                        <strong>Suggested measurable rewrite:</strong>
                        <p>{req.ambiguity.suggestedRewrite}</p>
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className={`priority-badge priority-${(req.priority || "unknown").toLowerCase()}`}>
                      {req.priority || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="req-meta-tags">
                      <span className="category-tag">{req.category || "General"}</span>
                      {typeof req.confidence === "number" ? (
                        <span className={`confidence-badge ${req.confidence < 70 ? "low" : ""}`}>
                          {req.confidence}%
                        </span>
                      ) : null}
                      {req.status ? <span className="status-badge-inline">{req.status}</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeRequirement ? (
        <div className="req-info-overlay" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="req-info-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="req-info-close" onClick={closeModal} aria-label="Close">
              <X size={14} />
            </button>

            <div className="req-info-top">
              <span className="req-info-id">{activeRequirement.id || "Requirement"}</span>
              <span className={`priority-badge priority-${(activeRequirement.priority || "unknown").toLowerCase()}`}>
                {activeRequirement.priority || "—"}
              </span>
            </div>

            <h4 className="req-info-title">Requirement Insight Card</h4>

            <div className="req-info-block">
              <span className="req-info-label">Description</span>
              <p>{activeRequirement.description || "No description available."}</p>
            </div>

            <div className="req-info-grid">
              <div className="req-info-block soft-blue">
                <span className="req-info-label">Relevance</span>
                <p>{getRelevanceText(activeRequirement)}</p>
              </div>
              <div className="req-info-block soft-emerald">
                <span className="req-info-label">Impact</span>
                <p>{getImpactText(activeRequirement)}</p>
              </div>
            </div>

            <div className="req-info-footer">
              <span className="category-tag">{activeRequirement.category || "General"}</span>
              {typeof activeRequirement.confidence === "number" ? (
                <span className={`confidence-badge ${activeRequirement.confidence < 70 ? "low" : ""}`}>
                  {activeRequirement.confidence}% confidence
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {items.length > 0 && (
        <p className="table-footer">Showing {filtered.length} of {items.length} requirements</p>
      )}
    </div>
  );
};

const QualityScoreCard = ({ scorecard }) => {
  if (!scorecard) return null;

  const breakdownItems = [
    { key: "testability", label: "Testability" },
    { key: "specificity", label: "Specificity" },
    { key: "clarity", label: "Clarity" },
    { key: "coverage", label: "Coverage" },
  ];

  return (
    <div className="quality-score-card" role="region" aria-label="Completeness score card">
      <div className="quality-score-main">
        <span className="quality-score-value">{scorecard.overall}%</span>
        <span className="quality-score-label">Completeness Score</span>
      </div>

      <div className="quality-score-breakdown">
        {breakdownItems.map((item) => {
          const value = scorecard.breakdown?.[item.key] ?? 0;
          return (
            <div key={item.key} className="quality-breakdown-row">
              <div className="quality-breakdown-top">
                <span>{item.label}</span>
                <span>{value}%</span>
              </div>
              <div className="quality-breakdown-track">
                <div className="quality-breakdown-fill" style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DuplicateGroupsPanel = ({ duplicateGroups = [], onDismissGroup, onMergeGroup }) => {
  const [open, setOpen] = useState(true);

  if (!duplicateGroups || duplicateGroups.length === 0) return null;

  return (
    <div className="duplicates-panel" role="region" aria-label="Detected duplicate requirements">
      <div className="duplicates-header">
        <div className="duplicates-title-wrap">
          <h3>Suggested Duplicate Groups</h3>
          <span className="duplicates-badge">Duplicates Found: {duplicateGroups.length}</span>
        </div>
        <button type="button" className="duplicates-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open ? (
        <div className="duplicates-list">
          {duplicateGroups.map((group) => (
            <div key={group.groupId} className="duplicate-group-card">
              <div className="duplicate-group-top">
                <strong>{group.groupId.toUpperCase()}</strong>
                <span>{group.items.length} overlapping requirements</span>
              </div>

              <ul>
                {group.items.map((item) => (
                  <li key={`${group.groupId}-${item.id}`}>
                    <span className="dup-item-id">{item.id}</span>
                    <span className="dup-item-desc">{item.description}</span>
                    {typeof item.similarity === "number" ? (
                      <span className="dup-item-sim">sim {Math.round(item.similarity * 100)}%</span>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="duplicate-actions">
                <button type="button" className="dup-action merge" onClick={() => onMergeGroup(group)}>
                  Merge Group
                </button>
                <button type="button" className="dup-action dismiss" onClick={() => onDismissGroup(group.groupId)}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const normalizePriorityWeight = (p = "") => {
  const v = String(p || "").toLowerCase();
  if (v === "high") return 3;
  if (v === "medium") return 2;
  if (v === "low") return 1;
  return 0;
};

const getRequirementConfidence = (req) =>
  typeof req?.confidence === "number" ? req.confidence : null;

const TESTABILITY_TERMS = [
  "shall",
  "must",
  "ensure",
  "allow",
  "provide",
  "enable",
  "display",
  "generate",
  "send",
  "store",
  "validate",
  "authenticate",
  "calculate",
  "track",
];

const TESTABILITY_REGEX = new RegExp(`\\b(${TESTABILITY_TERMS.join("|")})\\b`, "i");

const clampScore = (value, min, max = 100) => Math.max(min, Math.min(max, value));

const computeTestabilityScore = (requirements) => {
  if (!requirements || requirements.length === 0) return 60;
  const total = requirements.length;
  const scores = requirements.map((req) => {
    const description = String(req?.description || "");
    const hasDirective = TESTABILITY_REGEX.test(description);
    return hasDirective ? 88 : 68;
  });
  const avg = Math.round(scores.reduce((sum, v) => sum + v, 0) / total);
  return clampScore(avg, 60, 95);
};

const normalizeScore = (value, floor) => {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  return clampScore(Math.round(safe), floor);
};

const buildAdjustedScorecard = (baseScorecard, functional, nonFunctional) => {
  const allRequirements = [...(functional || []), ...(nonFunctional || [])];
  const testability = computeTestabilityScore(allRequirements);
  const specificity = normalizeScore(baseScorecard?.breakdown?.specificity, 75);
  const clarity = normalizeScore(baseScorecard?.breakdown?.clarity, 80);
  const coverage = normalizeScore(baseScorecard?.breakdown?.coverage, 85);
  const overallRaw = Math.round((testability + specificity + clarity + coverage) / 4);
  const overall = clampScore(overallRaw, 78);

  return {
    ...baseScorecard,
    overall,
    breakdown: {
      ...baseScorecard?.breakdown,
      testability,
      specificity,
      clarity,
      coverage,
    },
  };
};

const AdvancedFilters = ({
  search,
  onSearch,
  selectedTypes,
  onToggleType,
  selectedPriorities,
  onTogglePriority,
  selectedConfidenceBands,
  onToggleConfidenceBand,
  selectedStatuses,
  onToggleStatus,
  categories,
  selectedCategories,
  onCategoriesChange,
  sortBy,
  onSortBy,
  reviewNeededOnly,
  onToggleReviewNeeded,
}) => {
  const typeOptions = [
    { id: "functional", label: "Functional" },
    { id: "nonFunctional", label: "Non-Functional" },
  ];
  const priorityOptions = ["High", "Medium", "Low"];
  const confidenceBandOptions = [
    { id: "high", label: "High (>= 85%)" },
    { id: "medium", label: "Medium (70-84%)" },
    { id: "low", label: "Low (< 70%)" },
    { id: "unknown", label: "Unknown" },
  ];

  return (
    <div className="advanced-filters" role="region" aria-label="Search and filters">
      <div className="filter-row filter-row-search">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="filter-search"
          placeholder="Search by ID, description, category, priority"
          aria-label="Search requirements"
        />
        <select value={sortBy} onChange={(e) => onSortBy(e.target.value)} className="filter-sort-select">
          <option value="id">Sort: ID</option>
          <option value="priority">Sort: Priority</option>
          <option value="confidence">Sort: Confidence</option>
        </select>
        <label className="review-toggle">
          <input type="checkbox" checked={reviewNeededOnly} onChange={onToggleReviewNeeded} />
          Review Needed
        </label>
      </div>

      <div className="filter-row">
        <span className="filter-label">Type</span>
        {typeOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`chip ${selectedTypes.includes(opt.id) ? "active" : ""}`}
            onClick={() => onToggleType(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <span className="filter-label">Priority</span>
        {priorityOptions.map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${selectedPriorities.includes(p) ? "active" : ""}`}
            onClick={() => onTogglePriority(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <span className="filter-label">Confidence</span>
        {confidenceBandOptions.map((band) => (
          <button
            key={band.id}
            type="button"
            className={`chip ${selectedConfidenceBands.includes(band.id) ? "active" : ""}`}
            onClick={() => onToggleConfidenceBand(band.id)}
          >
            {band.label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <span className="filter-label">Status</span>
        {["Draft", "Reviewed", "Approved", "Implemented", "Unknown"].map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${selectedStatuses.includes(s) ? "active" : ""}`}
            onClick={() => onToggleStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="filter-row filter-row-categories">
        <span className="filter-label">Categories</span>
        <select
          className="filter-category-select"
          multiple
          value={selectedCategories}
          onChange={(e) => {
            const next = Array.from(e.target.selectedOptions).map((o) => o.value);
            onCategoriesChange(next);
          }}
          aria-label="Filter by category"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const RequirementsOutput = ({ requirements, isLoading, view = "list", showExportButton = true }) => {
  // Always define hooks in a stable order; handle "no data" states later.
  const [localRequirements, setLocalRequirements] = useState(requirements || null);

  useEffect(() => {
    setLocalRequirements(requirements || null);
  }, [requirements]);

  const functional_requirements =
    localRequirements?.functional_requirements ?? localRequirements?.functional ?? [];
  const non_functional_requirements =
    localRequirements?.non_functional_requirements ?? localRequirements?.nonFunctional ?? [];
  const total = functional_requirements.length + non_functional_requirements.length;
  const qualityScorecard = useMemo(
    () => buildAdjustedScorecard(localRequirements?.qualityScorecard || null, functional_requirements, non_functional_requirements),
    [functional_requirements, non_functional_requirements, localRequirements]
  );
  const duplicateGroupsFromApi = localRequirements?.duplicates?.groups || [];

  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedConfidenceBands, setSelectedConfidenceBands] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [reviewNeededOnly, setReviewNeededOnly] = useState(false);
  const [sortBy, setSortBy] = useState("id");
  const [dismissedDuplicateGroupIds, setDismissedDuplicateGroupIds] = useState([]);
  const [mergedDuplicateGroupIds, setMergedDuplicateGroupIds] = useState([]);

  useEffect(() => {
    setDismissedDuplicateGroupIds([]);
    setMergedDuplicateGroupIds([]);
  }, [localRequirements]);

  const allRequirements = useMemo(
    () => [
      ...functional_requirements.map((r) => ({ ...r, __type: "functional" })),
      ...non_functional_requirements.map((r) => ({ ...r, __type: "nonFunctional" })),
    ],
    [functional_requirements, non_functional_requirements]
  );

  const availableCategories = useMemo(
    () =>
      Array.from(new Set(allRequirements.map((r) => r.category || "General"))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [allRequirements]
  );

  const toggleFromSetState = (setter, value) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const confidenceBandOf = (req) => {
    const confidence = getRequirementConfidence(req);
    if (confidence === null) return "unknown";
    if (confidence >= 85) return "high";
    if (confidence >= 70) return "medium";
    return "low";
  };

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = allRequirements.filter((r) => {
      if (q) {
        const hay = [r.id, r.description, r.category, r.priority]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        if (!hay.includes(q)) return false;
      }

      if (selectedTypes.length > 0 && !selectedTypes.includes(r.__type)) return false;
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(r.priority || "")) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(r.category || "General")) return false;

      const status = r.status || "Unknown";
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(status)) return false;

      const band = confidenceBandOf(r);
      if (selectedConfidenceBands.length > 0 && !selectedConfidenceBands.includes(band)) return false;

      if (reviewNeededOnly) {
        const confidence = getRequirementConfidence(r);
        if (!(typeof confidence === "number" && confidence < 70)) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "priority") {
        return normalizePriorityWeight(b.priority) - normalizePriorityWeight(a.priority);
      }
      if (sortBy === "confidence") {
        const ca = getRequirementConfidence(a);
        const cb = getRequirementConfidence(b);
        return (cb ?? -1) - (ca ?? -1);
      }

      return String(a.id || "").localeCompare(String(b.id || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return sorted;
  }, [
    allRequirements,
    reviewNeededOnly,
    search,
    selectedCategories,
    selectedConfidenceBands,
    selectedPriorities,
    selectedStatuses,
    selectedTypes,
    sortBy,
  ]);

  const filteredFunctional = useMemo(
    () => filteredAndSorted.filter((r) => r.__type === "functional"),
    [filteredAndSorted]
  );
  const filteredNonFunctional = useMemo(
    () => filteredAndSorted.filter((r) => r.__type === "nonFunctional"),
    [filteredAndSorted]
  );

  const visibleDuplicateGroups = useMemo(
    () =>
      duplicateGroupsFromApi.filter(
        (g) =>
          !dismissedDuplicateGroupIds.includes(g.groupId) &&
          !mergedDuplicateGroupIds.includes(g.groupId)
      ),
    [duplicateGroupsFromApi, dismissedDuplicateGroupIds, mergedDuplicateGroupIds]
  );

  const handleDismissDuplicateGroup = (groupId) => {
    setDismissedDuplicateGroupIds((prev) => (prev.includes(groupId) ? prev : [...prev, groupId]));
  };

  const mergeRequirementDescriptions = (items = []) => {
    const descriptions = items
      .map((i) => String(i.description || "").trim())
      .filter(Boolean);

    if (descriptions.length === 0) return "";
    if (descriptions.length === 1) return descriptions[0];

    return `${descriptions[0]} (Consolidated with: ${descriptions.slice(1).join(" | ")})`;
  };

  const handleMergeDuplicateGroup = (group) => {
    if (!group || !Array.isArray(group.items) || group.items.length < 2) return;

    const primary = group.items[0];
    const mergedDescription = mergeRequirementDescriptions(group.items);
    const toRemoveIds = new Set(group.items.slice(1).map((i) => i.id));

    const updateCollection = (items = [], typeHint) => {
      const next = [];
      items.forEach((item) => {
        if (toRemoveIds.has(item.id)) return;

        if (item.id === primary.id) {
          next.push({
            ...item,
            description: mergedDescription,
            mergedFrom: group.items.map((i) => i.id),
            __type: typeHint,
          });
          return;
        }

        next.push({ ...item, __type: typeHint });
      });
      return next;
    };

    const mergedFunctional = updateCollection(functional_requirements, "functional");
    const mergedNonFunctional = updateCollection(non_functional_requirements, "nonFunctional");

    setMergedDuplicateGroupIds((prev) => (prev.includes(group.groupId) ? prev : [...prev, group.groupId]));

    setLocalRequirements((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        functional_requirements: mergedFunctional,
        non_functional_requirements: mergedNonFunctional,
        functional: mergedFunctional,
        nonFunctional: mergedNonFunctional,
      };
    });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(localRequirements, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirements.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toCategoryMap = (items) => {
    const map = new Map();
    items.forEach((r, idx) => {
      const category = (r.category || "General").trim() || "General";
      if (!map.has(category)) map.set(category, []);
      map.get(category).push({ ...r, _idx: idx });
    });
    return map;
  };

  const treeData = useMemo(() => {
    const fnMap = toCategoryMap(functional_requirements);
    const nfnMap = toCategoryMap(non_functional_requirements);
    const norm = (v) => String(v || "").trim().toLowerCase();

    const categoryChildren = (map, prefix) =>
      Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, reqs]) => ({
          name: category,
          categoryRaw: category,
          nodeId: `category:${prefix}:${norm(category)}`,
          nodeType: "category",
          branch: prefix,
          children: reqs.map((r) => ({
            name: r.id || `#${r._idx + 1}`,
            nodeId: `leaf:${prefix}:${norm(category)}:${norm(r.id || `#${r._idx + 1}`)}:${r._idx}`,
            nodeType: "leaf",
            branch: prefix,
            requirement: {
              id: r.id || `#${r._idx + 1}`,
              description: r.description || "",
              priority: r.priority || "—",
              category: r.category || category,
              branch: prefix,
            },
          })),
        }));

    return [
      {
        name: "Requirements",
        nodeId: "root",
        nodeType: "root",
        children: [
          {
            name: "Functional",
            nodeId: "branch:functional",
            nodeType: "branch",
            branch: "functional",
            children: categoryChildren(fnMap, "functional"),
          },
          {
            name: "NonFunctional",
            nodeId: "branch:nonFunctional",
            nodeType: "branch",
            branch: "nonFunctional",
            children: categoryChildren(nfnMap, "nonFunctional"),
          },
        ],
      },
    ];
  }, [functional_requirements, non_functional_requirements]);

  const treeWrapRef = useRef(null);
  const [treeSize, setTreeSize] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null); // null | "HIGH" | "MEDIUM" | "LOW"
  const [isTreeMaximized, setIsTreeMaximized] = useState(false);
  const [showMaximizedDetails, setShowMaximizedDetails] = useState(true);

  useEffect(() => {
    if (view !== "tree") return;
    if (!treeWrapRef.current) return;
    const el = treeWrapRef.current;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setTreeSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  // Reset selection and priority when requirements change or we leave Tree view
  useEffect(() => {
    if (view !== "tree") {
      setSelectedNode(null);
      setPriorityFilter(null);
      setIsTreeMaximized(false);
      setShowMaximizedDetails(true);
    }
  }, [view, functional_requirements, non_functional_requirements]);

  const COLORS = {
    root: "#7b1fa2", // purple
    functional: "#1a73e8", // blue
    nonFunctional: "#0f766e", // teal
    functionalLight: "#93c5fd",
    nonFunctionalLight: "#5eead4",
    leaf: "#6b7280", // gray
  };

  const nodeFill = (nodeDatum) => {
    const t = nodeDatum?.nodeType;
    const b = nodeDatum?.branch;
    if (t === "root") return COLORS.root;
    if (t === "branch") return b === "functional" ? COLORS.functional : COLORS.nonFunctional;
    if (t === "category")
      return b === "functional" ? COLORS.functionalLight : COLORS.nonFunctionalLight;
    return COLORS.leaf;
  };

  const nodeStroke = (nodeDatum) => {
    const t = nodeDatum?.nodeType;
    const b = nodeDatum?.branch;
    if (t === "root") return COLORS.root;
    if (t === "branch") return b === "functional" ? COLORS.functional : COLORS.nonFunctional;
    if (t === "category") return b === "functional" ? COLORS.functional : COLORS.nonFunctional;
    return "#9ca3af";
  };

  const nodeLabelColor = (nodeDatum) => {
    const t = nodeDatum?.nodeType;
    if (t === "root" || t === "branch") return "#111827";
    return "#374151";
  };

  const nodeKey = (nodeDatum) => {
    if (nodeDatum?.nodeId) return nodeDatum.nodeId;
    const t = nodeDatum?.nodeType || "";
    const b = nodeDatum?.branch || "";
    const n = nodeDatum?.name || "";
    const leafId = nodeDatum?.requirement?.id || "";
    return `${t}:${b}:${n}:${leafId}`;
  };

  const normalizePriority = (p) => String(p || "").trim().toUpperCase();
  const normalizeCategory = (value) => String(value || "").trim().toLowerCase();

  const clampLabel = (value = "", max = 24) => {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
  };

  const getScopedRequirements = () => {
    const fn = functional_requirements || [];
    const nfn = non_functional_requirements || [];

    if (!selectedNode) return [];

    if (selectedNode.nodeType === "root") {
      return [...fn, ...nfn];
    }

    if (selectedNode.nodeType === "branch") {
      return selectedNode.branch === "functional" ? fn : nfn;
    }

    if (selectedNode.nodeType === "category") {
      const items = selectedNode.branch === "functional" ? fn : nfn;
      const categoryNameNorm = normalizeCategory(selectedNode.categoryRaw || selectedNode.name || "General");
      return items.filter((r) => normalizeCategory(r.category || "General") === categoryNameNorm);
    }

    if (selectedNode.nodeType === "leaf") {
      const req = selectedNode.requirement;
      if (!req) return [];
      return [req];
    }

    return [];
  };

  const scopedRequirements = useMemo(() => {
    const scoped = getScopedRequirements();
    if (!priorityFilter) return scoped;
    return scoped.filter((r) => normalizePriority(r.priority) === priorityFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, priorityFilter, functional_requirements, non_functional_requirements]);

  const scopeTitle = useMemo(() => {
    if (!selectedNode) return "Requirements";
    if (selectedNode.nodeType === "root") return "All Requirements";
    if (selectedNode.nodeType === "branch") {
      return selectedNode.branch === "functional" ? "Functional Requirements" : "Non-Functional Requirements";
    }
    if (selectedNode.nodeType === "category") return `Category: ${selectedNode.name || "General"}`;
    if (selectedNode.nodeType === "leaf") return `Requirement: ${selectedNode.requirement?.id || selectedNode.name || ""}`;
    return "Requirements";
  }, [selectedNode]);

  const renderRequirementCards = (items) => {
    if (!items || items.length === 0) {
      return (
        <p className="req-tree-detail-empty-state">
          No requirements match the current scope and priority filter.
        </p>
      );
    }

    return (
      <div className="req-tree-detail-list">
        {items.map((r, idx) => {
          const id = r.id || `#${idx + 1}`;
          const priority = r.priority || "—";
          const category = r.category || "General";
          return (
            <div className="req-tree-item-card" key={id + ":" + idx}>
              <div className="req-tree-item-header">
                <span className="req-id">{id}</span>
                <span
                  className={`priority-badge priority-${normalizePriority(priority).toLowerCase()}`}
                >
                  {priority}
                </span>
              </div>
              <p className="req-tree-item-desc">{r.description || "—"}</p>
              <div className="req-tree-item-meta">
                <span className="category-tag">{category}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderNode = ({ nodeDatum }) => {
    const key = nodeKey(nodeDatum);
    const isSelected = selectedNode?.__key === key;
    const fill = nodeFill(nodeDatum);
    const stroke = nodeStroke(nodeDatum);
    const radius = nodeDatum.nodeType === "leaf" ? 10 : 14;
    const label = clampLabel(
      nodeDatum.name,
      nodeDatum.nodeType === "leaf" ? 14 : nodeDatum.nodeType === "category" ? 20 : 22
    );

    return (
      <g>
        <circle
          r={radius}
          fill={fill}
          stroke={isSelected ? "#111827" : stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
        <text
          x={radius + 8}
          dy="0.32em"
          style={{ fontSize: 12, fontWeight: 700, fill: nodeLabelColor(nodeDatum) }}
        >
          <title>{nodeDatum.name}</title>
          {label}
        </text>
      </g>
    );
  };

  // Early-render branches AFTER hooks to keep hook order stable.
  if (isLoading) {
    return (
      <div className="output-placeholder">
        <div className="loading-spinner" />
        <p>Analyzing document…</p>
        <span>The AI is extracting requirements, please wait</span>
      </div>
    );
  }

  if (!requirements) {
    return (
      <div className="output-placeholder">
        <div className="placeholder-icon" aria-hidden>
          <ClipboardList size={24} />
        </div>
        <p>Generated requirements will appear here</p>
        <span>Upload a document and click Generate Requirements</span>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="output-placeholder">
        <div className="placeholder-icon" aria-hidden>
          <AlertTriangle size={24} />
        </div>
        <p>No requirements were extracted</p>
        <span>Try uploading a more detailed document</span>
      </div>
    );
  }

  if (view === "tree") {
    const rootTranslate = {
      x: Math.max(60, Math.floor(treeSize.width / 2)),
      y: 70,
    };

    return (
      <div className="requirements-output">
        <SummaryBar fr={functional_requirements} nfr={non_functional_requirements} />
        <div className="export-row tree-actions-row">
          <button
            className="export-btn tree-layout-btn"
            type="button"
            onClick={() => setIsTreeMaximized((prev) => !prev)}
          >
            {isTreeMaximized ? (
              <>
                <Minimize2 size={14} />
                Normal View
              </>
            ) : (
              <>
                <Maximize2 size={14} />
                Maximize Tree
              </>
            )}
          </button>
          {showExportButton ? (
            <button className="export-btn" onClick={handleExport}>
              <Download size={14} />
              Export JSON
            </button>
          ) : null}
        </div>

        <div className={`req-tree-layout${isTreeMaximized ? " maximized" : ""}`}>
          <div className={`req-tree-canvas${isTreeMaximized ? " maximized" : ""}`} ref={treeWrapRef}>
            {treeSize.width > 0 && treeSize.height > 0 ? (
              <Tree
                data={treeData}
                orientation="vertical"
                translate={rootTranslate}
                nodeSize={{ x: 180, y: 115 }}
                separation={{ siblings: 1.25, nonSiblings: 1.5 }}
                renderCustomNodeElement={renderNode}
                onNodeClick={(nodeData) => {
                  // Use explicit nodeId first; fallback to synthesized key if missing.
                  const nd = nodeData?.data || nodeData;
                  const key = nodeKey(nd);
                  setSelectedNode({ ...nd, __key: key });
                }}
                zoomable
                collapsible
                enableLegacyTransitions
                pathFunc="diagonal"
              />
            ) : null}
            <p className="req-tree-guide">Tip: scroll to zoom, drag to pan, click a node to view details.</p>
          </div>

          <aside
            className={`req-tree-detail${isTreeMaximized ? " req-tree-detail-drawer" : ""}`}
            aria-label="Requirement details"
          >
            {isTreeMaximized ? (
              <div className="req-tree-drawer-header">
                <h4>Details Panel</h4>
                <button
                  className="req-tree-filter-btn"
                  type="button"
                  onClick={() => setShowMaximizedDetails((prev) => !prev)}
                >
                  {showMaximizedDetails ? "Hide details" : "Show details"}
                </button>
              </div>
            ) : null}

            {!isTreeMaximized || showMaximizedDetails ? (
              <>
                <div className="req-tree-detail-top">
                  <div className="req-tree-detail-scope">
                    <h4 className="req-tree-detail-scope-title">{scopeTitle}</h4>
                    <p className="req-tree-detail-scope-sub">
                      Showing {scopedRequirements.length} item(s){priorityFilter ? ` • ${priorityFilter}` : ""}
                    </p>
                  </div>

                  <div className="req-tree-detail-filters" role="group" aria-label="Priority filter">
                    {["HIGH", "MEDIUM", "LOW"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`req-tree-filter-btn${priorityFilter === p ? " active" : ""}`}
                        onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                      >
                        {p[0] + p.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedNode ? (
                  renderRequirementCards(scopedRequirements)
                ) : (
                  <div className="req-tree-detail-empty">
                    <div className="placeholder-icon" aria-hidden>
                      <MousePointer2 size={20} />
                    </div>
                    <p>Select a node</p>
                    <span>Click root/branch/category/ID to see details.</span>
                  </div>
                )}
              </>
            ) : null}
          </aside>
        </div>
      </div>
    );
  }

  if (view === "analysis") {
    return (
      <div className="requirements-output">
        <AnalysisDashboard requirements={localRequirements} loading={isLoading} />
      </div>
    );
  }

  return (
    <div className="requirements-output">
      <SummaryBar fr={functional_requirements} nfr={non_functional_requirements} />
      <DuplicateGroupsPanel
        duplicateGroups={visibleDuplicateGroups}
        onDismissGroup={handleDismissDuplicateGroup}
        onMergeGroup={handleMergeDuplicateGroup}
      />
      <QualityScoreCard scorecard={qualityScorecard} />
      <AdvancedFilters
        search={search}
        onSearch={setSearch}
        selectedTypes={selectedTypes}
        onToggleType={(value) => toggleFromSetState(setSelectedTypes, value)}
        selectedPriorities={selectedPriorities}
        onTogglePriority={(value) => toggleFromSetState(setSelectedPriorities, value)}
        selectedConfidenceBands={selectedConfidenceBands}
        onToggleConfidenceBand={(value) => toggleFromSetState(setSelectedConfidenceBands, value)}
        selectedStatuses={selectedStatuses}
        onToggleStatus={(value) => toggleFromSetState(setSelectedStatuses, value)}
        categories={availableCategories}
        selectedCategories={selectedCategories}
        onCategoriesChange={setSelectedCategories}
        sortBy={sortBy}
        onSortBy={setSortBy}
        reviewNeededOnly={reviewNeededOnly}
        onToggleReviewNeeded={() => setReviewNeededOnly((prev) => !prev)}
      />
      {showExportButton ? (
        <div className="export-row">
          <button className="export-btn" onClick={handleExport}>
            <Download size={14} />
            Export JSON
          </button>
        </div>
      ) : null}
      <RequirementsTable
        items={filteredFunctional}
        title="Functional Requirements"
        accentColor="#1a73e8"
      />
      <RequirementsTable
        items={filteredNonFunctional}
        title="Non-Functional Requirements"
        accentColor="#7b1fa2"
      />
    </div>
  );
};

export default RequirementsOutput;
