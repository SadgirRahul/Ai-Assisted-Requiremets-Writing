import React, { useEffect, useMemo, useRef, useState } from "react";
import Tree from "react-d3-tree";
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
  const priorities = ["All", "High", "Medium", "Low"];
  const filtered = filter === "All" ? items : items.filter((r) => r.priority === filter);

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
                <tr key={req.id || idx} className={idx % 2 === 0 ? "row-even" : "row-odd"}>
                  <td><span className="req-id">{req.id || `#${idx + 1}`}</span></td>
                  <td className="req-description">{req.description}</td>
                  <td>
                    <span className={`priority-badge priority-${(req.priority || "unknown").toLowerCase()}`}>
                      {req.priority || "—"}
                    </span>
                  </td>
                  <td><span className="category-tag">{req.category || "General"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <p className="table-footer">Showing {filtered.length} of {items.length} requirements</p>
      )}
    </div>
  );
};

const RequirementsOutput = ({ requirements, isLoading, view = "list", showExportButton = true }) => {
  // Always define hooks in a stable order; handle "no data" states later.
  const functional_requirements =
    requirements?.functional_requirements ?? requirements?.functional ?? [];
  const non_functional_requirements =
    requirements?.non_functional_requirements ?? requirements?.nonFunctional ?? [];
  const domainWarning = requirements?.domainWarning ?? null;
  const total = functional_requirements.length + non_functional_requirements.length;

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(requirements, null, 2)], {
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
  const [dismissedDomainWarning, setDismissedDomainWarning] = useState(false);

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

  useEffect(() => {
    setDismissedDomainWarning(false);
  }, [requirements]);

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
        <div className="placeholder-icon">📋</div>
        <p>Generated requirements will appear here</p>
        <span>Upload a document and click Generate Requirements</span>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="output-placeholder">
        <div className="placeholder-icon">⚠️</div>
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
        {domainWarning?.hasMismatch && !dismissedDomainWarning ? (
          <div className="domain-warning-banner" role="status" aria-live="polite">
            <span>
              ⚠ Results generated with possible domain mismatch (selected: {domainWarning.selectedDomain},
              detected: {domainWarning.detectedDomain}) — review requirements carefully
            </span>
            <button
              type="button"
              className="domain-warning-close"
              onClick={() => setDismissedDomainWarning(true)}
              aria-label="Dismiss mismatch warning"
            >
              ✕
            </button>
          </div>
        ) : null}
        <SummaryBar fr={functional_requirements} nfr={non_functional_requirements} />
        <div className="export-row tree-actions-row">
          <button
            className="export-btn tree-layout-btn"
            type="button"
            onClick={() => setIsTreeMaximized((prev) => !prev)}
          >
            {isTreeMaximized ? "🗕 Normal View" : "🗖 Maximize Tree"}
          </button>
          {showExportButton ? (
            <button className="export-btn" onClick={handleExport}>⬇ Export JSON</button>
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
                    <div className="placeholder-icon">👆</div>
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

  return (
    <div className="requirements-output">
      {domainWarning?.hasMismatch && !dismissedDomainWarning ? (
        <div className="domain-warning-banner" role="status" aria-live="polite">
          <span>
            ⚠ Results generated with possible domain mismatch (selected: {domainWarning.selectedDomain},
            detected: {domainWarning.detectedDomain}) — review requirements carefully
          </span>
          <button
            type="button"
            className="domain-warning-close"
            onClick={() => setDismissedDomainWarning(true)}
            aria-label="Dismiss mismatch warning"
          >
            ✕
          </button>
        </div>
      ) : null}
      <SummaryBar fr={functional_requirements} nfr={non_functional_requirements} />
      {showExportButton ? (
        <div className="export-row">
          <button className="export-btn" onClick={handleExport}>⬇ Export JSON</button>
        </div>
      ) : null}
      <RequirementsTable
        items={functional_requirements}
        title="Functional Requirements"
        accentColor="#1a73e8"
      />
      <RequirementsTable
        items={non_functional_requirements}
        title="Non-Functional Requirements"
        accentColor="#7b1fa2"
      />
    </div>
  );
};

export default RequirementsOutput;
