import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Tree from "react-d3-tree";
import "../components/RequirementsOutput.css";
import "./RequirementsTreePage.css";

const COLORS = {
  root: "#3C3489",
  functional: "#0C447C",
  nonFunctional: "#085041",
  functionalLight: "#B5D4F4",
  nonFunctionalLight: "#9FE1CB",
  leaf: "#F1EFE8",
  leafBorder: "#B4B2A9",
  leafText: "#444441",
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
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [zoom, setZoom] = useState(0.82);
  const [translate, setTranslate] = useState({ x: 0, y: 80 });

  useEffect(() => {
    if (!treeWrapRef.current) return;
    const el = treeWrapRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(0, Math.floor(rect.height));
      setTreeSize({ width, height });
      setTranslate({ x: Math.floor(width / 2), y: 80 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const treeData = useMemo(() => {
    const toCategoryMap = (items) => {
      const map = new Map();
      items.forEach((r, idx) => {
        const category = (r.category || "General").trim() || "General";
        if (!map.has(category)) map.set(category, []);
        map.get(category).push({ ...r, _idx: idx });
      });
      return map;
    };

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
            name: "Non-Functional",
            nodeId: "branch:nonFunctional",
            nodeType: "branch",
            branch: "nonFunctional",
            children: categoryChildren(nfnMap, "nonFunctional"),
          },
        ],
      },
    ];
  }, [functional_requirements, non_functional_requirements]);

  const getScopedRequirements = () => {
    const fn = functional_requirements || [];
    const nfn = non_functional_requirements || [];
    if (!selectedNode) return [];

    if (selectedNode.nodeType === "root") return [...fn, ...nfn];
    if (selectedNode.nodeType === "branch") {
      return selectedNode.branch === "functional" ? fn : nfn;
    }
    if (selectedNode.nodeType === "category") {
      const items = selectedNode.branch === "functional" ? fn : nfn;
      const clickedCategory = String(selectedNode.name || "").trim();
      return items.filter((r) => String(r.category || "").trim() === clickedCategory);
    }
    if (selectedNode.nodeType === "leaf") {
      const items = selectedNode.branch === "functional" ? fn : nfn;
      const clickedId = String(selectedNode.name || "").trim();
      const found = items.find((r) => String(r.id || "").trim() === clickedId);
      return found ? [found] : [];
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

  const fitToScreen = () => {
    if (!treeSize.width) return;
    setTranslate({ x: Math.floor(treeSize.width / 2), y: 80 });
    setZoom(0.82);
  };

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.12).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.25, +(z - 0.12).toFixed(2)));

  const renderNode = ({ nodeDatum }) => {
    const key = nodeKey(nodeDatum);
    const isSelected = selectedNode?.__key === key;
    const t = nodeDatum?.nodeType;
    const b = nodeDatum?.branch;
    const isRoot = t === "root";
    const isBranch = t === "branch";
    const isCategory = t === "category";
    const isLeaf = t === "leaf";

    const categoryLines = isCategory ? splitCategoryLabel(nodeDatum?.name || "") : [String(nodeDatum?.name || "")];
    const isTwoLineCategory = isCategory && categoryLines.length === 2;

    const width = isRoot ? 180 : isBranch ? 170 : isCategory ? 160 : 100;
    const height = isRoot ? 48 : isBranch ? 44 : isCategory ? (isTwoLineCategory ? 52 : 40) : 34;
    const rx = isLeaf ? 8 : 10;
    const ry = isLeaf ? 8 : 10;

    const fill = isRoot
      ? COLORS.root
      : isBranch
        ? b === "functional"
          ? COLORS.functional
          : COLORS.nonFunctional
        : isCategory
          ? b === "functional"
            ? COLORS.functionalLight
            : COLORS.nonFunctionalLight
          : COLORS.leaf;

    const baseStroke = isLeaf
      ? COLORS.leafBorder
      : isRoot
        ? COLORS.root
        : b === "functional"
          ? COLORS.functional
          : COLORS.nonFunctional;

    const stroke = isSelected ? "#111827" : baseStroke;
    const textColor = isRoot || isBranch
      ? "#ffffff"
      : isCategory
        ? b === "functional"
          ? COLORS.functional
          : COLORS.nonFunctional
        : COLORS.leafText;
    const fontSize = isRoot || isBranch ? 14 : 13;
    const fontWeight = isRoot || isBranch ? 500 : 400;
    const lines = isCategory ? categoryLines : [String(nodeDatum?.name || "")];

    return (
      <g>
        <rect
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          rx={rx}
          ry={ry}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize,
            fontWeight,
            fill: textColor,
            pointerEvents: "none",
            fontFamily: "\"Inter\", \"Segoe UI\", sans-serif",
          }}
        >
          <title>{nodeDatum.name}</title>
          {isTwoLineCategory ? (
            <>
              <tspan x="0" dy="-0.3em">{lines[0]}</tspan>
              <tspan x="0" dy="1.2em">{lines[1]}</tspan>
            </>
          ) : (
            <tspan x="0" dy="0.1em">{lines[0]}</tspan>
          )}
        </text>
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

  if (!requirements) {
    return (
      <div className="tree-page">
        <div className="tree-navbar">
          <button type="button" className="tree-back-btn" onClick={() => navigate(-1)}>
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
        <button type="button" className="tree-back-btn" onClick={() => navigate(-1)}>
          ← Back to Results
        </button>
        <div className="tree-navbar-meta">
          <h3>Requirements Tree</h3>
          {selectedDomain ? <span className="tree-domain-pill">{selectedDomain}</span> : null}
        </div>
        <div className="tree-controls">
          <button type="button" onClick={zoomOut}>-</button>
          <button type="button" onClick={zoomIn}>+</button>
          <button type="button" onClick={fitToScreen}>Fit to screen</button>
        </div>
      </div>

      <div className="tree-canvas-wrap" ref={treeWrapRef}>
        {treeSize.width > 0 && treeSize.height > 0 ? (
          <Tree
            data={treeData}
            orientation="vertical"
            translate={translate}
            zoom={zoom}
            nodeSize={{ x: 220, y: 140 }}
            separation={{ siblings: 1.4, nonSiblings: 1.8 }}
            renderCustomNodeElement={renderNode}
            onNodeClick={(nodeData) => {
              const nd = nodeData?.data || nodeData;
              console.log("[Tree Click]", nd?.name);
              const key = nodeKey(nd);
              setSelectedNode({ ...nd, __key: key });
              setIsDrawerOpen(true);
            }}
            zoomable
            collapsible
            enableLegacyTransitions
            pathFunc="diagonal"
          />
        ) : null}
      </div>

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
