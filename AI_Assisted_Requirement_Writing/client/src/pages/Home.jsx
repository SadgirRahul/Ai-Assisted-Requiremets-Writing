import React, { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, CheckSquare, ClipboardList, Compass, FolderUp, Loader2, RotateCcw, X } from "lucide-react";
import DomainSelect, { DOMAIN_OPTIONS } from "../components/DomainSelect";
import FileUpload from "../components/FileUpload";
import RequirementsOutput from "../components/RequirementsOutput";
import DeveloperView from "../components/DeveloperView";
import TopNavbar from "../components/TopNavbar";
import "./Home.css";

// Status values: 'idle' | 'loading' | 'success'
const STATUS = { IDLE: "idle", LOADING: "loading", SUCCESS: "success" };
const OUTPUT_VIEW = { LIST: "list", ANALYSIS: "analysis", TREE: "tree" };
const PANEL_TAB = { GENERATED: "generated", DEVELOPER: "developer" };
const ANALYZE_DEVELOPER_ENDPOINT = import.meta.env.VITE_ANALYZE_DEVELOPER_URL || "http://localhost:5000/api/analyze-developer";

const asArray = (value) => (Array.isArray(value) ? value : []);

const toApiRequirement = (req, fallbackType) => ({
  id: req?.id || "",
  description: req?.description || "",
  type: req?.type || fallbackType,
  priority: req?.priority || "Medium",
  category: req?.category || "General",
});

const getDeveloperAnalysisByReqId = (developerData, reqId) => {
  if (!Array.isArray(developerData)) return null;
  return (
    developerData.find(
      (item) =>
        String(item?.requirement_id || "") === String(reqId || "") ||
        String(item?.id || "") === String(reqId || "")
    ) || null
  );
};

const normalizeList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const Home = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [outputView, setOutputView] = useState(OUTPUT_VIEW.LIST);
  const [outputPanelTab, setOutputPanelTab] = useState(PANEL_TAB.GENERATED);

  const [requirements, setRequirements] = useState(null);
  const [error, setError]               = useState(null);
  const [status, setStatus]             = useState(STATUS.IDLE);
  const [fileName, setFileName]         = useState("");
  const [hasExported, setHasExported]   = useState(false);
  const [developerData, setDeveloperData] = useState([]);
  const [developerLoading, setDeveloperLoading] = useState(false);
  const [developerError, setDeveloperError] = useState("");
  const [taskProgress, setTaskProgress] = useState({});

  useEffect(() => {
    const state = location.state;
    if (!state || !state.requirements) return;

    setRequirements(state.requirements);
    setSelectedDomain(state.selectedDomain || null);
    setFileName(state.fileName || "");
    setShowUpload(true);
    setStatus(STATUS.SUCCESS);
    setOutputView(state.returnView === OUTPUT_VIEW.TREE ? OUTPUT_VIEW.TREE : OUTPUT_VIEW.LIST);
  }, [location.state]);

  // Called by FileUpload when the AI response arrives
  const handleResult = useCallback((result) => {
    setError(null);
    if (result && result.requirements) {
      setRequirements(result.requirements);
      setStatus(STATUS.SUCCESS);
      setHasExported(false);
      setDeveloperData([]);
      setDeveloperError("");
      setTaskProgress({});
      setOutputPanelTab(PANEL_TAB.GENERATED);
    } else {
      setRequirements(null);
      setStatus(STATUS.IDLE);
      setHasExported(false);
      setDeveloperData([]);
      setDeveloperError("");
      setTaskProgress({});
    }
  }, []);

  // Called by FileUpload when it starts generating (optional signal)
  const handleLoading = useCallback((name) => {
    setError(null);
    setRequirements(null);
    setStatus(STATUS.LOADING);
    setHasExported(false);
    setDeveloperData([]);
    setDeveloperError("");
    setTaskProgress({});
    setOutputPanelTab(PANEL_TAB.GENERATED);
    if (name) setFileName(name);
  }, []);

  // Called by FileUpload when an error occurs
  const handleError = useCallback((message) => {
    setError(message);
    setStatus(STATUS.IDLE);
    setRequirements(null);
    setHasExported(false);
    setDeveloperData([]);
    setDeveloperError("");
    setTaskProgress({});
    setOutputPanelTab(PANEL_TAB.GENERATED);
  }, []);

  // Dismiss error banner
  const dismissError = () => setError(null);

  // Clear everything and start fresh
  const handleReset = () => {
    setSelectedDomain(null);
    setShowUpload(false);
    setOutputView(OUTPUT_VIEW.LIST);
    setRequirements(null);
    setError(null);
    setStatus(STATUS.IDLE);
    setFileName("");
    setHasExported(false);
    setDeveloperData([]);
    setDeveloperError("");
    setTaskProgress({});
    setOutputPanelTab(PANEL_TAB.GENERATED);
  };

  // Human-readable output panel header
  const outputHeading = () => {
    if (status === STATUS.LOADING)
      return { label: "Generating…", badge: "loading", icon: <Loader2 size={16} /> };
    if (status === STATUS.SUCCESS)
      return { label: "Generated Requirements", badge: "success", icon: <CheckSquare size={16} /> };
    return { label: "Generated Requirements", badge: "", icon: <ClipboardList size={16} /> };
  };

  const { label, badge, icon } = outputHeading();

  const domainBadgeLabel = DOMAIN_OPTIONS.find((d) => d.id === selectedDomain)?.name;
  const hasResults = status === STATUS.SUCCESS && !!requirements;
  const duplicateGroupCount = requirements?.duplicates?.groups?.length || 0;
  const functionalRequirements = asArray(
    requirements?.functional_requirements || requirements?.functional || requirements?.requirements?.functional
  );
  const nonFunctionalRequirements = asArray(
    requirements?.non_functional_requirements || requirements?.nonFunctional || requirements?.requirements?.non_functional
  );

  const normalizedRequirementsForDeveloper = [
    ...functionalRequirements.map((req) => toApiRequirement(req, "Functional")),
    ...nonFunctionalRequirements.map((req) => toApiRequirement(req, "Non-Functional")),
  ];

  const handleExportFromNavbar = useCallback(() => {
    if (!requirements) return;
    const blob = new Blob([JSON.stringify(requirements, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirements.json";
    a.click();
    URL.revokeObjectURL(url);
    setHasExported(true);
  }, [requirements]);

  const handleAnalyzeForDevelopers = useCallback(async () => {
    if (!hasResults) return;

    setDeveloperLoading(true);
    setDeveloperError("");

    try {
      const requirementsArray = normalizedRequirementsForDeveloper;
      const response = await axios.post(ANALYZE_DEVELOPER_ENDPOINT, {
        requirements: requirementsArray,
        domain: selectedDomain,
      });

      console.log("/analyze-developer response:", response.data);
      setDeveloperData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to analyze requirements for developers.";
      setDeveloperError(message);
    } finally {
      setDeveloperLoading(false);
    }
  }, [hasResults, normalizedRequirementsForDeveloper, domainBadgeLabel, selectedDomain]);

  const handleToggleTaskCheck = useCallback((reqId, taskIndex, totalTasks) => {
    setTaskProgress((prev) => {
      const previousList = Array.isArray(prev[reqId]) ? prev[reqId] : Array(totalTasks).fill(false);
      const nextList = previousList.map((value, idx) => (idx === taskIndex ? !value : value));
      return {
        ...prev,
        [reqId]: nextList,
      };
    });
  }, []);

  const handleExportDeveloperReport = useCallback(() => {
    const lines = [];
    const now = new Date();
    let totalEstimatedHours = 0;

    lines.push("====================================");
    lines.push("DEVELOPER IMPLEMENTATION REPORT");
    lines.push(`Domain: ${domainBadgeLabel || selectedDomain || "General"}`);
    lines.push(`Generated: ${now.toLocaleString()}`);
    lines.push("====================================");
    lines.push("");

    functionalRequirements.forEach((req, index) => {
      const reqId = req?.id || `FR-${index + 1}`;
      const description = req?.description || "No description available.";
      const category = req?.category || "General";
      const analysis = getDeveloperAnalysisByReqId(developerData, reqId);
      const tasks = normalizeList(analysis?.tasks);
      const techStack = analysis?.tech_stack || {};
      const complexity = analysis?.complexity || {};
      const level = complexity?.level || "Medium";
      const estimatedHours = Number.isFinite(Number(complexity?.estimated_hours))
        ? Number(complexity.estimated_hours)
        : 0;

      totalEstimatedHours += estimatedHours;

      lines.push(`${reqId}: ${description}`);
      lines.push(`Complexity: ${level} | Estimated: ${estimatedHours} hours`);
      lines.push(`Category: ${category}`);
      lines.push("");
      lines.push("Developer Tasks:");

      if (tasks.length > 0) {
        tasks.forEach((task, taskIndex) => {
          lines.push(`  ${taskIndex + 1}. ${task}`);
        });
      } else {
        lines.push("  1. No tasks returned");
      }

      const frontend = normalizeList(techStack.frontend);
      const backend = normalizeList(techStack.backend);
      const database = normalizeList(techStack.database);
      const other = normalizeList(techStack.other);

      lines.push("");
      lines.push("Tech Stack:");
      lines.push(`  Frontend  : ${frontend.length ? frontend.join(", ") : "-"}`);
      lines.push(`  Backend   : ${backend.length ? backend.join(", ") : "-"}`);
      lines.push(`  Database  : ${database.length ? database.join(", ") : "-"}`);
      lines.push(`  Other     : ${other.length ? other.join(", ") : "-"}`);
      lines.push("");
      lines.push("------------------------------------");
      lines.push("");
    });

    lines.push(`TOTAL ESTIMATED HOURS: ${totalEstimatedHours}`);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "developer-report.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [functionalRequirements, developerData, domainBadgeLabel, selectedDomain]);

  const navbarActiveView = outputPanelTab === PANEL_TAB.DEVELOPER
    ? "developer"
    : outputView;

  return (
    <div className="home-page">
      <TopNavbar
        activeView={navbarActiveView}
        selectedDomain={domainBadgeLabel || null}
        hasResults={hasResults}
        onSelectView={(view) => {
          if (view === OUTPUT_VIEW.LIST) {
            setOutputPanelTab(PANEL_TAB.GENERATED);
            setOutputView(OUTPUT_VIEW.LIST);
            return;
          }

          if (view === OUTPUT_VIEW.ANALYSIS) {
            if (!requirements || status !== STATUS.SUCCESS) return;
            setOutputPanelTab(PANEL_TAB.GENERATED);
            setOutputView(OUTPUT_VIEW.ANALYSIS);
            return;
          }

          if (view === PANEL_TAB.DEVELOPER) {
            if (!requirements || status !== STATUS.SUCCESS) return;
            setOutputPanelTab(PANEL_TAB.DEVELOPER);
            return;
          }

          if (view === OUTPUT_VIEW.TREE) {
            if (!requirements || status !== STATUS.SUCCESS) return;
            navigate("/requirements/tree", {
              state: {
                requirements,
                selectedDomain,
                fileName,
              },
            });
          }
        }}
        onExport={handleExportFromNavbar}
        onReset={handleReset}
      />

      {/* ── Error banner ──────────────────────────── */}
      {error && (
        <div className="error-banner" role="alert">
          <span className="error-message">
            <AlertTriangle size={16} />
            {error}
          </span>
          <button className="error-close" onClick={dismissError} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Two-panel layout ──────────────────────── */}
      <div className="home-container">

        {/* Input Panel */}
        <section className="panel input-panel" aria-label="Input section">
          <div className="panel-header">
            <h2 className="panel-title">
              {showUpload ? (
                <>
                  <FolderUp size={18} />
                  <span>Upload document</span>
                </>
              ) : (
                <>
                  <Compass size={18} />
                  <span>Choose domain</span>
                </>
              )}
            </h2>
            {(requirements || error || showUpload || selectedDomain) && (
              <button className="reset-btn" onClick={handleReset} title="Start over">
                <RotateCcw size={14} />
                Reset
              </button>
            )}
          </div>

          <div className="panel-body">
            {!showUpload ? (
              <DomainSelect
                selectedDomain={selectedDomain}
                onSelect={setSelectedDomain}
                onContinue={() => setShowUpload(true)}
              />
            ) : (
              <FileUpload
                selectedDomain={selectedDomain}
                onDomainChange={setSelectedDomain}
                onBackToDomainSelect={() => setShowUpload(false)}
                onResult={handleResult}
                onError={handleError}
                onLoading={handleLoading}
              />
            )}
          </div>

          {status === STATUS.SUCCESS && fileName && (
            <p className="source-file">Source: <strong>{fileName}</strong></p>
          )}
        </section>

        {/* Output Panel */}
        <section className="panel output-panel" aria-label="Output section">
          <div className="panel-header output-panel-header">
            <div className="flex flex-wrap items-center gap-3">
              <h2>
                <span>{icon}</span>
                <span>{label}</span>
                {badge && <span className={`status-badge status-${badge}`}>{badge}</span>}
                {hasResults && duplicateGroupCount > 0 ? (
                  <span className="duplicates-header-badge">Duplicates Found: {duplicateGroupCount}</span>
                ) : null}
              </h2>
            </div>
          </div>

          <div className="panel-body">
            {outputPanelTab === PANEL_TAB.GENERATED ? (
              <RequirementsOutput
                requirements={requirements}
                isLoading={status === STATUS.LOADING}
                view={outputView}
                showExportButton={false}
              />
            ) : (
              <DeveloperView
                functionalRequirements={functionalRequirements}
                developerData={developerData}
                selectedDomainLabel={domainBadgeLabel || selectedDomain || "General"}
                isLoading={developerLoading}
                error={developerError}
                onAnalyze={handleAnalyzeForDevelopers}
                onExportReport={handleExportDeveloperReport}
                taskProgress={taskProgress}
                onToggleTask={handleToggleTaskCheck}
              />
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

export default Home;
