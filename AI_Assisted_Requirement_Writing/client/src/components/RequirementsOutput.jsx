import React, { useState } from "react";
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

const RequirementsOutput = ({ requirements, isLoading }) => {
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

  const { functional_requirements = [], non_functional_requirements = [] } = requirements;
  const total = functional_requirements.length + non_functional_requirements.length;

  if (total === 0) {
    return (
      <div className="output-placeholder">
        <div className="placeholder-icon">⚠️</div>
        <p>No requirements were extracted</p>
        <span>Try uploading a more detailed document</span>
      </div>
    );
  }

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

  return (
    <div className="requirements-output">
      <SummaryBar fr={functional_requirements} nfr={non_functional_requirements} />
      <div className="export-row">
        <button className="export-btn" onClick={handleExport}>⬇ Export JSON</button>
      </div>
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
