import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DomainSelect, { DOMAIN_OPTIONS } from "../components/DomainSelect";
import FileUpload from "../components/FileUpload";
import RequirementsOutput from "../components/RequirementsOutput";
import "./Home.css";

// Status values: 'idle' | 'loading' | 'success'
const STATUS = { IDLE: "idle", LOADING: "loading", SUCCESS: "success" };
const OUTPUT_VIEW = { LIST: "list", TREE: "tree" };

const Home = () => {
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [outputView, setOutputView] = useState(OUTPUT_VIEW.LIST);

  const [requirements, setRequirements] = useState(null);
  const [error, setError]               = useState(null);
  const [status, setStatus]             = useState(STATUS.IDLE);
  const [fileName, setFileName]         = useState("");

  // Called by FileUpload when the AI response arrives
  const handleResult = useCallback((result) => {
    setError(null);
    if (result && result.requirements) {
      setRequirements(result.requirements);
      setStatus(STATUS.SUCCESS);
    } else {
      setRequirements(null);
      setStatus(STATUS.IDLE);
    }
  }, []);

  // Called by FileUpload when it starts generating (optional signal)
  const handleLoading = useCallback((name) => {
    setError(null);
    setRequirements(null);
    setStatus(STATUS.LOADING);
    if (name) setFileName(name);
  }, []);

  // Called by FileUpload when an error occurs
  const handleError = useCallback((message) => {
    setError(message);
    setStatus(STATUS.IDLE);
    setRequirements(null);
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

  return (
    <div className="home-page">
      {/* ── Page header ───────────────────────────── */}
      <header className="home-header">
        <div className="home-header-inner">
          <div className="home-title-row">
            <h1 className="home-title">AI Requirements Generator</h1>
            {status === STATUS.SUCCESS && domainBadgeLabel ? (
              <span
                className="home-domain-badge"
                title="Domain context used for this generation"
              >
                {domainBadgeLabel}
              </span>
            ) : null}
          </div>
          <p className="home-subtitle">
            Upload a project document (PDF / DOCX) and let AI extract structured
            functional &amp; non-functional requirements.
          </p>
        </div>
      </header>

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
          <div className="panel-header">
            <h2>
              <span>{icon}</span>
              <span>{label}</span>
              {badge && <span className={`status-badge status-${badge}`}>{badge}</span>}
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
            />
          </div>
        </section>

      </div>
    </div>
  );
};

export default Home;
