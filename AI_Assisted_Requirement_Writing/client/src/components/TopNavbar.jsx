import React from "react";
import "./TopNavbar.css";

const STEPS = [
  { id: 1, label: "Domain" },
  { id: 2, label: "Upload" },
  { id: 3, label: "Results" },
  { id: 4, label: "Export" },
];

const TopNavbar = ({ currentStep, selectedDomain, hasResults, onExport, onReset }) => {
  const isDone = (id) => id < currentStep;
  const isActive = (id) => id === currentStep;

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

        <div className="topnav-steps" aria-label="Workflow steps">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="topnav-step">
                <span
                  className={[
                    "topnav-step-circle",
                    isDone(step.id) ? "done" : "",
                    isActive(step.id) ? "active" : "",
                  ].join(" ").trim()}
                >
                  {step.id}
                </span>
                <span
                  className={[
                    "topnav-step-label",
                    isDone(step.id) ? "done" : "",
                    isActive(step.id) ? "active" : "",
                  ].join(" ").trim()}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 ? (
                <span
                  className={`topnav-step-line ${currentStep > step.id + 0 ? "done" : ""}`}
                  aria-hidden="true"
                />
              ) : null}
            </React.Fragment>
          ))}
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
