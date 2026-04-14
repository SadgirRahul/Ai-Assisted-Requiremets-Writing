import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Tree from "react-d3-tree";
import "../components/RequirementsOutput.css";
import "./RequirementsTreePage.css";

const BRANCH_STYLES = {
  root: { fill: "#EEEDFE", border: "#7F77DD", text: "#3C3489" },
  functional: { fill: "#E6F1FB", border: "#378ADD", text: "#0C447C" },
  nonFunctional: { fill: "#E1F5EE", border: "#1D9E75", text: "#085041" },
  domain: { fill: "#FAEEDA", border: "#BA7517", text: "#633806" },
  constraints: { fill: "#FAECE7", border: "#D85A30", text: "#712B13" },
  businessRules: { fill: "#FBEAF0", border: "#D4537E", text: "#72243E" },
  transition: { fill: "#EAF3DE", border: "#639922", text: "#27500A" },
};

const TOP_BRANCH_ORDER = [
  "functional",
  "nonFunctional",
  "domain",
  "constraints",
  "businessRules",
  "transition",
];

const TOP_BRANCH_LABEL = {
  functional: "Functional",
  nonFunctional: "Non-Functional",
  domain: "Domain",
  constraints: "Constraints",
  businessRules: "Business Rules",
  transition: "Transition",
};

const COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const normalizeCategory = (value) => String(value || "").trim().toLowerCase();
const normalizePriority = (p) => String(p || "").trim().toUpperCase();

const splitCategoryLabel = (value = "") => {
  const text = String(value || "").trim();
  if (text.length <= 14) return [text];

  const middle = Math.floor(text.length / 2);
  let bestSplit = -1;
  let smallestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== " ") continue;
    const d = Math.abs(i - middle);
    if (d < smallestDistance) {
      smallestDistance = d;
      bestSplit = i;
    }
  }

  if (bestSplit === -1) return [text];
  return [text.slice(0, bestSplit).trim(), text.slice(bestSplit + 1).trim()];
};

const nodeKey = (nodeDatum) => {
  if (nodeDatum?.nodeId) return nodeDatum.nodeId;
  const t = nodeDatum?.nodeType || "";
  const b = nodeDatum?.branch || "";
  const n = nodeDatum?.name || "";
  const leafId = nodeDatum?.requirement?.id || "";
  return `${t}:${b}:${n}:${leafId}`;
};

const priorityDot = (priority = "") => {
  const p = normalizePriority(priority);
  if (p === "HIGH") return COLORS.high;
  if (p === "MEDIUM") return COLORS.medium;
  if (p === "LOW") return COLORS.low;
  return "#64748b";
};

const snippet = (text = "", max = 32) => {
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  if (!clean) return "Requirement";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}...`;
};

const inferTopBranch = (req) => {
  const text = `${req.description || ""} ${req.category || ""} ${req.subcategory || ""}`.toLowerCase();
  if (/\b(pricing|discount|eligibility|approval|workflow rule|business rule)\b/.test(text)) {
    return "businessRules";
  }
  if (/\b(technical constraint|regulatory constraint|resource constraint|environmental constraint|constraint)\b/.test(text)) {
    return "constraints";
  }
  if (/\b(compliance|domain rule|industry standard|standard)\b/.test(text)) {
    return "domain";
  }
  if (/\b(data migration|training|parallel operation|cutover|rollback|transition)\b/.test(text)) {
    return "transition";
  }
  return req.__type === "functional" ? "functional" : "nonFunctional";
};

const makeParentAndNodeMaps = (tree) => {
  const parentMap = new Map();
  const nodeMap = new Map();

  const visit = (node, parent = null) => {
    if (!node?.nodeId) return;
    nodeMap.set(node.nodeId, node);
    parentMap.set(node.nodeId, parent?.nodeId || null);
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child) => visit(child, node));
  };

  tree.forEach((root) => visit(root, null));
  return { parentMap, nodeMap };
};

const RequirementsTreePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const requirements = location.state?.requirements ?? null;
  const selectedDomain = location.state?.selectedDomain ?? null;

  const functional_requirements =
    requirements?.functional_requirements ?? requirements?.functional ?? [];
  const non_functional_requirements =
    requirements?.non_functional_requirements ?? requirements?.nonFunctional ?? [];

  const treeWrapRef = useRef(null);
  const [treeSize, setTreeSize] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLeaf, setSelectedLeaf] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [zoom, setZoom] = useState(0.8);
  const [translate, setTranslate] = useState({ x: 0, y: 72 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [isTreeReady, setIsTreeReady] = useState(false);

  useEffect(() => {
    if (!treeWrapRef.current) return;
    const el = treeWrapRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(0, Math.floor(rect.height));
      setTreeSize({ width, height });
      setTranslate({ x: Math.floor(width / 2), y: 72 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const treeData = useMemo(() => {
    const normalize = (v, fallback = "General") => {
      const s = String(v ?? "").trim();
      return s.length > 0 ? s : fallback;
    };
    const norm = (v) => normalize(v).toLowerCase();

    const makeLeaf = (req, idx, branch, category) => ({
      name: normalize(req.id, `FR-${idx + 1}`),
      nodeType: "leaf",
      branch,
      nodeId: `leaf:${branch}:${norm(category)}:${norm(req.id || `#${idx + 1}`)}:${idx}`,
      reqData: {
        id: normalize(req.id, `#${idx + 1}`),
        description: normalize(req.description, ""),
        priority: normalize(req.priority, "Medium"),
        category: normalize(req.category, category),
        subcategory: normalize(req.subcategory, normalize(req.category, category)),
        branch,
      },
      requirement: {
        id: normalize(req.id, `#${idx + 1}`),
        description: normalize(req.description, ""),
        priority: normalize(req.priority, "Medium"),
        category: normalize(req.category, category),
        subcategory: normalize(req.subcategory, normalize(req.category, category)),
        branch,
      },
    });

    const buildBranch = (items, branch) => {
      const categoryMap = new Map(); // category -> subcategory -> req[]

      items.forEach((req, idx) => {
        const category = normalize(req.category, "General");
        const subcategory = normalize(req.subcategory, category);
        if (!categoryMap.has(category)) categoryMap.set(category, new Map());
        const subMap = categoryMap.get(category);
        if (!subMap.has(subcategory)) subMap.set(subcategory, []);
        subMap.get(subcategory).push({ req, idx });
      });

      return Array.from(categoryMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, subMap]) => {
          const subEntries = Array.from(subMap.entries()).sort(([a], [b]) => a.localeCompare(b));
          const shouldSkipAllSubcategoryLevel =
            subEntries.length === 1 ||
            subEntries.every(([sub]) => norm(sub) === norm(category));

          let children = [];
          if (shouldSkipAllSubcategoryLevel) {
            children = subEntries.flatMap(([, list]) =>
              list.map(({ req, idx }) => makeLeaf(req, idx, branch, category))
            );
          } else {
            children = subEntries.flatMap(([subcategory, list]) => {
              if (list.length === 1) {
                const { req, idx } = list[0];
                return [makeLeaf(req, idx, branch, category)];
              }
              return [
                {
                  name: subcategory,
                  nodeType: "subcategory",
                  branch,
                  categoryRaw: category,
                  subcategoryRaw: subcategory,
                  nodeId: `subcategory:${branch}:${norm(category)}:${norm(subcategory)}`,
                  children: list.map(({ req, idx }) => makeLeaf(req, idx, branch, category)),
                },
              ];
            });
          }

          return {
            name: category,
            nodeType: "category",
            branch,
            categoryRaw: category,
            nodeId: `category:${branch}:${norm(category)}`,
            children,
          };
        });
    };

    const allReqs = [
      ...functional_requirements.map((r) => ({ ...r, __type: "functional" })),
      ...non_functional_requirements.map((r) => ({ ...r, __type: "nonFunctional" })),
    ];

    const branchBuckets = {
      functional: [],
      nonFunctional: [],
      domain: [],
      constraints: [],
      businessRules: [],
      transition: [],
    };

    allReqs.forEach((r) => {
      const key = inferTopBranch(r);
      branchBuckets[key].push(r);
    });

    const topChildren = TOP_BRANCH_ORDER.filter((k) => branchBuckets[k].length > 0).map((k) => ({
      name: TOP_BRANCH_LABEL[k],
      nodeType: "branch",
      branch: k,
      nodeId: `branch:${k}`,
      children: buildBranch(branchBuckets[k], k),
    }));

    return [
      {
        name: "Requirements",
        nodeType: "root",
        nodeId: "root",
        children: topChildren,
      },
    ];
  }, [functional_requirements, non_functional_requirements]);

  const { parentMap, nodeMap } = useMemo(() => makeParentAndNodeMaps(treeData), [treeData]);

  const highlightedEdges = useMemo(() => {
    if (!hoveredNodeId || !nodeMap.has(hoveredNodeId)) return new Set();
    const edges = new Set();
    let cursor = hoveredNodeId;
    while (cursor) {
      const parent = parentMap.get(cursor);
      if (!parent) break;
      edges.add(`${parent}->${cursor}`);
      cursor = parent;
    }
    return edges;
  }, [hoveredNodeId, nodeMap, parentMap]);

  useEffect(() => {
    setIsTreeReady(false);
    const t = setTimeout(() => setIsTreeReady(true), 30);
    return () => clearTimeout(t);
  }, [treeData]);

  const getScopedRequirements = () => {
    const fn = functional_requirements || [];
    const nfn = non_functional_requirements || [];
    if (!selectedNode) return [];

    if (selectedNode.nodeType === "root") return [...fn, ...nfn];
    if (selectedNode.nodeType === "branch") return selectedNode.branch === "functional" ? fn : nfn;
    if (selectedNode.nodeType === "category") {
      const items = selectedNode.branch === "functional" ? fn : nfn;
      return items.filter((r) => String(r.category || "").trim() === String(selectedNode.name || "").trim());
    }
    if (selectedNode.nodeType === "subcategory") {
      const items = selectedNode.branch === "functional" ? fn : nfn;
      return items.filter(
        (r) => String(r.subcategory || r.category || "").trim() === String(selectedNode.name || "").trim()
      );
    }
    if (selectedNode.nodeType === "leaf") return selectedNode.reqData ? [selectedNode.reqData] : [];
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

  const fitToScreen = () => {
    if (!treeSize.width) return;
    setTranslate({ x: Math.floor(treeSize.width / 2), y: 72 });
    setZoom(0.8);
  };

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.12).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.25, +(z - 0.12).toFixed(2)));

  const handleTreeNodeClick = (nodeData) => {
    const nd = nodeData?.data || nodeData;
    const nodeType = nd?.nodeType || nodeData?.nodeType;
    const leafPayload = nd?.reqData || nd?.requirement || nodeData?.reqData || nodeData?.requirement;

    console.log("[Tree Click]", nd?.name || nodeData?.name);
    const key = nodeKey(nd || nodeData);
    setSelectedNode({ ...(nd || nodeData), __key: key });
    setIsDrawerOpen(true);

    if (nodeType === "leaf" && leafPayload) {
      setSelectedLeaf((prev) => (prev?.id === leafPayload.id ? null : { ...leafPayload }));
    } else {
      setSelectedLeaf(null);
    }
  };

  const renderNode = ({ nodeDatum }) => {
    const key = nodeKey(nodeDatum);
    const isSelected = selectedNode?.__key === key;
    const t = nodeDatum?.nodeType;
    const b = nodeDatum?.branch;
    const isRoot = t === "root";
    const isBranch = t === "branch";
    const isCategory = t === "category";
    const isSubcategory = t === "subcategory";
    const isLeaf = t === "leaf";

    const categoryLines = isCategory ? splitCategoryLabel(nodeDatum?.name || "") : [String(nodeDatum?.name || "")];
    const isTwoLineCategory = isCategory && categoryLines.length === 2;

    const width = isRoot
      ? Math.max(160, Math.min(250, String(nodeDatum?.name || "").length * 9 + 30))
      : isBranch
        ? Math.max(140, Math.min(220, String(nodeDatum?.name || "").length * 8 + 28))
        : Math.max(120, Math.min(210, String(nodeDatum?.name || "").length * 8 + 24));
    const height = isRoot ? 48 : isBranch ? 44 : 36;
    const rx = isLeaf ? 12 : isRoot ? 16 : 12;
    const ry = rx;

    const branchStyle = BRANCH_STYLES[b] || BRANCH_STYLES.root;
    const fill = isRoot ? BRANCH_STYLES.root.fill : branchStyle.fill;
    const baseStroke = isRoot ? BRANCH_STYLES.root.border : branchStyle.border;

    const stroke = isSelected ? baseStroke : baseStroke;
    const textColor = isRoot ? BRANCH_STYLES.root.text : branchStyle.text;
    const fontSize = isRoot ? 15 : isBranch ? 14 : 13;
    const fontWeight = isRoot ? 600 : isBranch ? 500 : 400;
    const childCount = Array.isArray(nodeDatum?.children) ? nodeDatum.children.length : 0;
    const collapsedChildrenCount = Array.isArray(nodeDatum?._children) ? nodeDatum._children.length : 0;
    const depth = nodeDatum?.__rd3t?.depth ?? 0;

    // Optional safety: truncate long single-word category labels to avoid overflow.
    const safeLines = isCategory
      ? categoryLines.map((line) => {
          if (line.includes(" ") || line.length <= 16) return line;
          return `${line.slice(0, 15)}...`;
        })
      : [String(nodeDatum?.name || "")];

    const effectiveFontSize = isTwoLineCategory ? 12 : fontSize;
    const letterSpacing = isRoot || isBranch ? "0.025em" : "0.02em";

    return (
      <g
        onClick={() => handleTreeNodeClick(nodeDatum)}
        onMouseEnter={() => setHoveredNodeId(nodeDatum?.nodeId || key)}
        onMouseLeave={() => setHoveredNodeId(null)}
        style={{ cursor: "pointer", opacity: isTreeReady ? 1 : 0, animation: `treeNodeFade 240ms ease ${depth * 80}ms both` }}
      >
        <rect
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          rx={rx}
          ry={ry}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 2.3 : 1.3}
        />
        {isLeaf ? (
          <circle
            cx={-width / 2 + 11}
            cy={0}
            r={4.2}
            fill={priorityDot(nodeDatum?.requirement?.priority || nodeDatum?.reqData?.priority)}
          />
        ) : null}
        <text
          x={isLeaf ? -width / 2 + 21 : 0}
          textAnchor={isLeaf ? "start" : "middle"}
          dominantBaseline="central"
          style={{
            fontSize: effectiveFontSize,
            fontWeight,
            fill: textColor,
            pointerEvents: "none",
            fontFamily: "\"Inter\", \"Segoe UI\", sans-serif",
            letterSpacing,
            wordSpacing: "0.03em",
          }}
        >
          <title>{nodeDatum.name}{nodeDatum?.requirement?.description ? `\n${nodeDatum.requirement.description}` : ""}</title>
          {isTwoLineCategory ? (
            <>
              <tspan x="0" dy="-0.38em">{safeLines[0]}</tspan>
              <tspan x="0" dy="1.3em">{safeLines[1]}</tspan>
            </>
          ) : (
            <tspan x="0" dy="0.1em">{safeLines[0]}</tspan>
          )}
        </text>
        {!isLeaf && collapsedChildrenCount > 0 ? (
          <g>
            <rect x={width / 2 - 24} y={-height / 2 + 2} width={20} height={14} rx={7} fill={stroke} />
            <text x={width / 2 - 14} y={-height / 2 + 9} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 9, fontWeight: 700, fill: "#ffffff" }}>
              +{Math.min(collapsedChildrenCount, 99)}
            </text>
          </g>
        ) : null}
      </g>
    );
  };

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
                <span className={`priority-badge priority-${normalizePriority(priority).toLowerCase()}`}>
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

  const renderLeafDetailCard = () => {
    if (!selectedLeaf) return null;
    const id = selectedLeaf.id || "—";
    const description = selectedLeaf.description || "—";
    const priority = selectedLeaf.priority || "Medium";
    const category = selectedLeaf.category || "General";
    const subcategory = selectedLeaf.subcategory || category;
    const showSubcategory = String(subcategory).trim() !== String(category).trim();

    return (
      <div className={`tree-leaf-card-wrap ${selectedLeaf ? "open" : ""}`}>
        <div className="tree-leaf-card">
          <button
            type="button"
            className="tree-leaf-card-close"
            aria-label="Close requirement details"
            onClick={() => setSelectedLeaf(null)}
          >
            ✕
          </button>
          <div className="tree-leaf-card-header">
            <span className="req-id">{id}</span>
            <span className={`priority-badge priority-${normalizePriority(priority).toLowerCase()}`}>
              {priority}
            </span>
          </div>
          <p className="tree-leaf-card-desc">{description}</p>
          <div className="tree-leaf-card-meta">
            <span className="category-tag">{category}</span>
            {showSubcategory ? <span className="category-tag">Sub: {subcategory}</span> : null}
          </div>
        </div>
      </div>
    );
  };

  if (!requirements) {
    return (
      <div className="tree-page">
        <div className="tree-navbar">
          <button
            type="button"
            className="tree-back-btn"
            onClick={() => navigate("/", { state: { ...location.state, returnView: "tree" } })}
          >
            ← Back to Results
          </button>
        </div>
        <div className="tree-empty">
          <h2>No generated requirements found</h2>
          <p>Go back and generate requirements first, then open Tree view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tree-page">
      <div className="tree-navbar">
        <button
          type="button"
          className="tree-back-btn"
          onClick={() => navigate("/", { state: { ...location.state, returnView: "tree" } })}
        >
          ← Back to Results
        </button>
        <div className="tree-navbar-meta">
          <h3>Requirements Tree</h3>
          {selectedDomain ? <span className="tree-domain-pill">{selectedDomain}</span> : null}
        </div>
        <div className="tree-controls">
          <button type="button" onClick={zoomOut}>−</button>
          <button type="button" onClick={zoomIn}>+</button>
          <button type="button" onClick={fitToScreen}>Fit to screen</button>
        </div>
      </div>

      <div className="tree-legend" aria-label="Tree legend">
        <span><i className="dot root" />Root</span>
        <span><i className="dot functional" />Functional</span>
        <span><i className="dot nonfunctional" />Non-Functional</span>
        <span><i className="dot domain" />Domain</span>
        <span><i className="dot constraints" />Constraints</span>
        <span><i className="dot businessRules" />Business Rules</span>
        <span><i className="dot transition" />Transition</span>
      </div>

      <div className="tree-canvas-wrap" ref={treeWrapRef}>
        {treeSize.width > 0 && treeSize.height > 0 ? (
          <Tree
            data={treeData}
            orientation="vertical"
            translate={translate}
            zoom={zoom}
            nodeSize={{ x: 220, y: 84 }}
            separation={{ siblings: 1.1, nonSiblings: 1.28 }}
            renderCustomNodeElement={renderNode}
            pathClassFunc={(linkData) => {
              const targetBranch = linkData?.target?.data?.branch || linkData?.target?.branch;
              const sourceId = linkData?.source?.data?.nodeId || linkData?.source?.nodeId;
              const targetId = linkData?.target?.data?.nodeId || linkData?.target?.nodeId;
              const edgeKey = `${sourceId}->${targetId}`;
              const active = highlightedEdges.has(edgeKey) ? " tree-link-active" : "";

              if (targetBranch === "functional") return `tree-link tree-link-functional${active}`;
              if (targetBranch === "nonFunctional") return `tree-link tree-link-nonfunctional${active}`;
              if (targetBranch === "domain") return `tree-link tree-link-domain${active}`;
              if (targetBranch === "constraints") return `tree-link tree-link-constraints${active}`;
              if (targetBranch === "businessRules") return `tree-link tree-link-businessRules${active}`;
              if (targetBranch === "transition") return `tree-link tree-link-transition${active}`;
              return `tree-link${active}`;
            }}
            zoomable
            collapsible
            enableLegacyTransitions
            transitionDuration={200}
            pathFunc="elbow"
          />
        ) : null}
      </div>

      <div className="tree-minimap" aria-hidden="true">
        <Tree
          data={treeData}
          orientation="vertical"
          translate={{ x: 60, y: 14 }}
          zoom={0.18}
          nodeSize={{ x: 220, y: 84 }}
          separation={{ siblings: 1.1, nonSiblings: 1.28 }}
          renderCustomNodeElement={({ nodeDatum }) => (
            <g>
              <rect x={-3} y={-3} width={6} height={6} rx={2} fill={(BRANCH_STYLES[nodeDatum?.branch] || BRANCH_STYLES.root).border} />
            </g>
          )}
          pathClassFunc={(linkData) => {
            const targetBranch = linkData?.target?.data?.branch || linkData?.target?.branch;
            if (targetBranch === "functional") return "tree-link tree-link-functional";
            if (targetBranch === "nonFunctional") return "tree-link tree-link-nonfunctional";
            if (targetBranch === "domain") return "tree-link tree-link-domain";
            if (targetBranch === "constraints") return "tree-link tree-link-constraints";
            if (targetBranch === "businessRules") return "tree-link tree-link-businessRules";
            if (targetBranch === "transition") return "tree-link tree-link-transition";
            return "tree-link";
          }}
          zoomable={false}
          collapsible={false}
          pathFunc="elbow"
        />
      </div>
      {renderLeafDetailCard()}

      <aside className={`tree-drawer ${isDrawerOpen ? "open" : ""}`} aria-label="Requirement details drawer">
        <div className="tree-drawer-header">
          <div>
            <h4>{scopeTitle}</h4>
            <p>
              Showing {scopedRequirements.length} item(s){priorityFilter ? ` • ${priorityFilter}` : ""}
            </p>
          </div>
          <button type="button" className="tree-drawer-close" onClick={() => setIsDrawerOpen(false)}>
            ✕
          </button>
        </div>

        <div className="tree-drawer-filters" role="group" aria-label="Priority filter">
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

        {selectedNode ? (
          renderRequirementCards(scopedRequirements)
        ) : (
          <div className="req-tree-detail-empty">
            <div className="placeholder-icon">👆</div>
            <p>Select a node</p>
            <span>Click root/branch/category/ID to see details.</span>
          </div>
        )}
      </aside>
    </div>
  );
};

export default RequirementsTreePage;
