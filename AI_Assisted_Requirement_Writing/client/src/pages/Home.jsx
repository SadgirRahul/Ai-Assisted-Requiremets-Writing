import React, { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DomainSelect, { DOMAIN_OPTIONS } from "../components/DomainSelect";
import FileUpload from "../components/FileUpload";
import RequirementsOutput from "../components/RequirementsOutput";
import TopNavbar from "../components/TopNavbar";
import "./Home.css";

// Status values: 'idle' | 'loading' | 'success'
const STATUS = { IDLE: "idle", LOADING: "loading", SUCCESS: "success" };
const OUTPUT_VIEW = { LIST: "list", ANALYSIS: "analysis", TREE: "tree" };

const Home = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [outputView, setOutputView] = useState(OUTPUT_VIEW.LIST);

  const [requirements, setRequirements] = useState(null);
  const [error, setError]               = useState(null);
  const [status, setStatus]             = useState(STATUS.IDLE);
  const [fileName, setFileName]         = useState("");
  const [hasExported, setHasExported]   = useState(false);

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
    } else {
      setRequirements(null);
      setStatus(STATUS.IDLE);
      setHasExported(false);
    }
  }, []);

  // Called by FileUpload when it starts generating (optional signal)
  const handleLoading = useCallback((name) => {
    setError(null);
    setRequirements(null);
    setStatus(STATUS.LOADING);
    setHasExported(false);
    if (name) setFileName(name);
  }, []);

  // Called by FileUpload when an error occurs
  const handleError = useCallback((message) => {
    setError(message);
    setStatus(STATUS.IDLE);
    setRequirements(null);
    setHasExported(false);
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
  };

  // Human-readable output panel header
  const outputHeading = () => {
    if (status === STATUS.LOADING)
      return { label: "Generating…", badge: "loading", icon: "⏳" };
    if (status === STATUS.SUCCESS)
      return { label: "Generated Requirements", badge: "success", icon: "✅" };
    return { label: "Generated Requirements", badge: "", icon: "📋" };
  };

  const { label, badge, icon } = outputHeading();

  const domainBadgeLabel = DOMAIN_OPTIONS.find((d) => d.id === selectedDomain)?.name;
  const hasResults = status === STATUS.SUCCESS && !!requirements;
  const duplicateGroupCount = requirements?.duplicates?.groups?.length || 0;

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

  const currentStep = !showUpload
    ? 1
    : !hasResults
      ? 2
      : hasExported
        ? 4
        : 3;

  return (
    <div className="home-page">
      <TopNavbar
        currentStep={currentStep}
        selectedDomain={domainBadgeLabel || null}
        hasResults={hasResults}
        onExport={handleExportFromNavbar}
        onReset={handleReset}
      />

      {/* ── Error banner ──────────────────────────── */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠️ {error}</span>
          <button className="error-close" onClick={dismissError} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      {/* ── Two-panel layout ──────────────────────── */}
      <div className="home-container">

        {/* Input Panel */}
        <section className="panel input-panel" aria-label="Input section">
          <div className="panel-header">
            <h2>{showUpload ? "📂 Upload document" : "🧭 Choose domain"}</h2>
            {(requirements || error || showUpload || selectedDomain) && (
              <button className="reset-btn" onClick={handleReset} title="Start over">
                ↺ Reset
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
            <h2>
              <span>{icon}</span>
              <span>{label}</span>
              {badge && <span className={`status-badge status-${badge}`}>{badge}</span>}
              {hasResults && duplicateGroupCount > 0 ? (
                <span className="duplicates-header-badge">Duplicates Found: {duplicateGroupCount}</span>
              ) : null}
            </h2>
            <div className="view-toggle" role="tablist" aria-label="Requirements view">
              <button
                type="button"
                role="tab"
                aria-selected={outputView === OUTPUT_VIEW.LIST}
                className={`view-toggle-btn${outputView === OUTPUT_VIEW.LIST ? " active" : ""}`}
                onClick={() => setOutputView(OUTPUT_VIEW.LIST)}
              >
                List
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={outputView === OUTPUT_VIEW.ANALYSIS}
                className={`view-toggle-btn${outputView === OUTPUT_VIEW.ANALYSIS ? " active" : ""}`}
                onClick={() => {
                  if (!requirements || status !== STATUS.SUCCESS) return;
                  setOutputView(OUTPUT_VIEW.ANALYSIS);
                }}
              >
                Analysis
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={outputView === OUTPUT_VIEW.TREE}
                className={`view-toggle-btn${outputView === OUTPUT_VIEW.TREE ? " active" : ""}`}
                onClick={() => {
                  if (!requirements || status !== STATUS.SUCCESS) return;
                  navigate("/requirements/tree", {
                    state: {
                      requirements,
                      selectedDomain,
                      fileName,
                    },
                  });
                }}
              >
                Tree
              </button>
            </div>
          </div>

          <div className="panel-body">
            <RequirementsOutput
              requirements={requirements}
              isLoading={status === STATUS.LOADING}
              view={outputView}
              showExportButton={false}
            />
          </div>
        </section>

      </div>
    </div>
  );
};

export default Home;
