import React, { useMemo, useState } from "react";
import { ClipboardList, Download, Loader2, Settings, ListChecks, X } from "lucide-react";

const complexityStyles = {
  low: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border border-amber-200",
  high: "bg-red-100 text-red-700 border border-red-200",
};

const techPillStyles = {
  frontend: "bg-blue-100 text-blue-700 border border-blue-200",
  backend: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  database: "bg-orange-100 text-orange-700 border border-orange-200",
  other: "bg-slate-100 text-slate-700 border border-slate-200",
};

const labelStyles = {
  frontend: "text-blue-700",
  backend: "text-emerald-700",
  database: "text-orange-700",
  other: "text-slate-700",
};

const complexityClass = (level) => {
  const key = String(level || "medium").trim().toLowerCase();
  return complexityStyles[key] || complexityStyles.medium;
};

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const getAnalysisForRequirement = (developerData, reqId) => {
  if (!Array.isArray(developerData)) return null;
  return (
    developerData.find(
      (item) =>
        String(item?.requirement_id || "") === String(reqId || "") ||
        String(item?.id || "") === String(reqId || "")
    ) || null
  );
};

const DeveloperView = ({
  functionalRequirements,
  developerData,
  selectedDomainLabel,
  isLoading,
  error,
  onAnalyze,
  onExportReport,
  taskProgress,
  onToggleTask,
}) => {
  const items = Array.isArray(functionalRequirements) ? functionalRequirements : [];
  const [activeRequirement, setActiveRequirement] = useState(null);

  const stats = useMemo(() => {
    const analyzed = Array.isArray(developerData) ? developerData.length : 0;
    let totalEstimatedHours = 0;
    let highComplexity = 0;
    let mediumComplexity = 0;
    let totalTasks = 0;
    let completedTasks = 0;

    (developerData || []).forEach((analysis) => {
      const complexity = analysis?.complexity || {};
      const level = String(complexity?.level || "").trim();
      const hours = Number(complexity?.estimated_hours);
      const tasks = toArray(analysis?.tasks);

      if (Number.isFinite(hours)) {
        totalEstimatedHours += hours;
      }
      if (level === "High") {
        highComplexity += 1;
      }
      if (level === "Medium") {
        mediumComplexity += 1;
      }

      totalTasks += tasks.length;
      const reqId = String(analysis?.requirement_id || "");
      const stored = Array.isArray(taskProgress?.[reqId]) ? taskProgress[reqId] : [];
      completedTasks += stored.filter(Boolean).length;
    });

    return {
      analyzed,
      totalEstimatedHours,
      highComplexity,
      mediumComplexity,
      completedTasks,
      totalTasks,
    };
  }, [developerData, taskProgress]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-600">
          Analyze functional requirements and generate developer tasks, stack recommendations, and effort for
          <span className="ml-1 font-semibold text-slate-800">{selectedDomainLabel || "General"}</span>.
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onExportReport}
            disabled={items.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={16} />
            Export Developer Report
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isLoading || items.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#185fa5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f4d89] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />}
            {isLoading ? "Analyzing requirements..." : "Analyze for Developers"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-3 md:grid-cols-5">
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-2xl font-bold leading-none text-white">{stats.analyzed}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-300">Total FR Analyzed</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-2xl font-bold leading-none text-white">{stats.totalEstimatedHours}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-300">Total Estimated Hours</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-2xl font-bold leading-none text-white">{stats.highComplexity}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-300">High Complexity</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-2xl font-bold leading-none text-white">{stats.mediumComplexity}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-300">Medium Complexity</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-2xl font-bold leading-none text-white">
            {stats.completedTasks} / {stats.totalTasks}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-300">Tasks Completed</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white">
          <Loader2 size={28} className="animate-spin text-[#185fa5]" />
          <p className="text-sm font-medium text-slate-600">Analyzing requirements...</p>
        </div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No functional requirements available.
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="grid gap-4">
          {items.map((req, index) => {
            const reqId = req?.id || `FR-${index + 1}`;
            const reqDescription = req?.description || "No description available.";
            const analysis = getAnalysisForRequirement(developerData, reqId);
            const tasks = toArray(analysis?.tasks);
            const techStack = analysis?.tech_stack || {};
            const complexity = analysis?.complexity || {};
            const complexityLevel = String(complexity?.level || "Medium");
            const estimatedHours = complexity?.estimated_hours ?? 0;

            return (
              <article key={`${reqId}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {reqId}
                    </span>
                    <p className="text-sm leading-6 text-slate-700">{reqDescription}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${complexityClass(complexityLevel)}`}>
                      {complexityLevel}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      ~{estimatedHours} hrs
                    </span>
                  </div>
                </div>

                <div className="mb-4 rounded-lg border border-slate-100 bg-white p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-800">Recommended Tech Stack</h4>

                  {[
                    ["frontend", "Frontend"],
                    ["backend", "Backend"],
                    ["database", "Database"],
                    ["other", "Other"],
                  ].map(([key, label]) => {
                    const values = toArray(techStack?.[key]);
                    return (
                      <div key={key} className="mb-2 flex flex-wrap items-center gap-2 last:mb-0">
                        <span className={`w-[88px] text-xs font-semibold uppercase tracking-wide ${labelStyles[key]}`}>
                          {label}
                        </span>
                        {values.length > 0 ? (
                          values.map((tech, idx) => (
                            <span
                              key={`${key}-${idx}`}
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${techPillStyles[key]}`}
                            >
                              {tech}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveRequirement({
                      id: reqId,
                      description: reqDescription,
                      tasks,
                    })}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <ListChecks size={14} />
                    View Tasks
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {activeRequirement ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setActiveRequirement(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {activeRequirement.id}
                </span>
                <p className="mt-2 text-sm text-slate-700">{activeRequirement.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRequirement(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ClipboardList size={16} className="text-[#185fa5]" />
                Developer Tasks
              </div>
              {activeRequirement.tasks.length === 0 ? (
                <p className="text-sm text-slate-500">No tasks returned by analysis.</p>
              ) : (
                <div className="space-y-2">
                  {activeRequirement.tasks.map((task, taskIndex) => {
                    const stored = Array.isArray(taskProgress?.[activeRequirement.id])
                      ? taskProgress[activeRequirement.id]
                      : [];
                    const checked = !!stored[taskIndex];

                    return (
                      <label
                        key={`${activeRequirement.id}-${taskIndex}`}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                          checked ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-100 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleTask(activeRequirement.id, taskIndex, activeRequirement.tasks.length)}
                          className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-[#185fa5] focus:ring-[#185fa5]"
                        />
                        <span className={checked ? "line-through" : ""}>{task}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              {(() => {
                const total = activeRequirement.tasks.length;
                const stored = Array.isArray(taskProgress?.[activeRequirement.id])
                  ? taskProgress[activeRequirement.id]
                  : [];
                const completed = stored.filter(Boolean).length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <div className="space-y-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{completed} of {total} tasks completed</span>
                      <button
                        type="button"
                        onClick={() => setActiveRequirement(null)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DeveloperView;
