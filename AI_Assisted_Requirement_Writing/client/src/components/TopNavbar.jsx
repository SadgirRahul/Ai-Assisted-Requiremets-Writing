import React from "react";
import "./TopNavbar.css";

const TopNavbar = ({ activeView, selectedDomain, hasResults, onSelectView, onExport, onReset }) => {
  const isActive = (view) => view === activeView;

  return (
    <div className="topnav-wrap">
      <div className="topnav-accent" />
      <nav className="topnav" aria-label="Workflow navigation">
        <button
          type="button"
          className="topnav-brand"
          onClick={onReset}
          title="Reset and start over"
        >
          <span className="topnav-logo" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" role="img">
              <rect x="1" y="1" width="6" height="6" rx="1.2" fill="#B5D4F4" />
              <rect x="9" y="1" width="6" height="6" rx="1.2" fill="#B5D4F4" />
              <rect x="1" y="9" width="6" height="6" rx="1.2" fill="#B5D4F4" />
              <rect x="9" y="9" width="6" height="6" rx="1.2" fill="#B5D4F4" />
            </svg>
          </span>
          <span className="topnav-brand-text">
            <span className="topnav-name">
              Req<span>AI</span>
            </span>
            <span className="topnav-tagline">Requirements Generator</span>
          </span>
        </button>

        <div className="topnav-tabs" role="tablist" aria-label="Requirements view">
          <button
            type="button"
            role="tab"
            aria-selected={isActive("list")}
            className={`topnav-tab-btn${isActive("list") ? " active" : ""}`}
            onClick={() => onSelectView?.("list")}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isActive("analysis")}
            className={`topnav-tab-btn${isActive("analysis") ? " active" : ""}`}
            onClick={() => onSelectView?.("analysis")}
            disabled={!hasResults}
            title={!hasResults ? "Generate requirements first" : ""}
          >
            Analysis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isActive("tree")}
            className={`topnav-tab-btn${isActive("tree") ? " active" : ""}`}
            onClick={() => onSelectView?.("tree")}
            disabled={!hasResults}
            title={!hasResults ? "Generate requirements first" : ""}
          >
            Tree
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isActive("developer")}
            className={`topnav-tab-btn${isActive("developer") ? " active" : ""}`}
            onClick={() => onSelectView?.("developer")}
            disabled={!hasResults}
            title={!hasResults ? "Generate requirements first" : ""}
          >
            Developer View
          </button>
        </div>

        <div className="topnav-right">
          {selectedDomain ? <span className="topnav-domain-badge">{selectedDomain}</span> : null}
          {hasResults ? (
            <button type="button" className="topnav-export-btn" onClick={onExport}>
              Export JSON
            </button>
          ) : null}
        </div>
      </nav>
    </div>
  );
};

export default TopNavbar;
