import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  FileText,
  Layers,
  ShieldAlert,
  Activity,
  Sun,
  Moon,
  Download,
  Filter,
} from "lucide-react";
import DashboardCard from "./dashboard/DashboardCard";
import StatsCard from "./dashboard/StatsCard";
import ChartCard from "./dashboard/ChartCard";
import DashboardSkeleton from "./dashboard/DashboardSkeleton";

const TAXONOMY = {
  "Functional Requirements": [
    "Business requirements",
    "User requirements",
    "System/feature requirements",
    "Interface requirements",
  ],
  "Non-Functional Requirements": [
    "Performance",
    "Scalability",
    "Reliability & Availability",
    "Security",
    "Usability",
    "Maintainability",
    "Portability",
    "Compatibility",
    "Recoverability",
  ],
  "Domain Requirements": [
    "Compliance requirements",
    "Domain rules",
    "Industry standards",
  ],
  "Transition Requirements": [
    "Data migration",
    "Training",
    "Parallel operation",
    "Cutover/rollback",
  ],
  Constraints: ["Technical", "Regulatory", "Resource", "Environmental"],
  "Business Rules": [
    "Pricing/discount logic",
    "Eligibility criteria",
    "Workflow approval rules",
  ],
};

const RULES = {
  "Business Rules": {
    "Pricing/discount logic": [/\b(price|pricing|discount|coupon|offer|rate|fee|billing)\b/i],
    "Eligibility criteria": [/\b(eligible|eligibility|criteria|qualify|qualification|threshold)\b/i],
    "Workflow approval rules": [/\b(approve|approval|workflow|escalation|authorization flow|sign-off)\b/i],
  },
  Constraints: {
    Technical: [/\b(tech stack|platform|technology|legacy|database|api limit|infra|architecture)\b/i],
    Regulatory: [/\b(regulatory|law|legal|gdpr|hipaa|pci|sox|compliance mandate)\b/i],
    Resource: [/\b(budget|cost|headcount|resource|timeframe|deadline|timeline)\b/i],
    Environmental: [/\b(environment|on-prem|cloud region|hardware|temperature|power|network zone)\b/i],
  },
  "Transition Requirements": {
    "Data migration": [/\b(migration|migrate|data move|data transfer|backfill)\b/i],
    Training: [/\b(training|onboarding|enablement|user training|documentation training)\b/i],
    "Parallel operation": [/\b(parallel run|parallel operation|dual run|side-by-side)\b/i],
    "Cutover/rollback": [/\b(cutover|rollback|roll back|go-live|fallback)\b/i],
  },
  "Domain Requirements": {
    "Compliance requirements": [/\b(compliance|audit|policy|mandate|certification)\b/i],
    "Domain rules": [/\b(domain rule|business domain|industry rule|regimen|clinical protocol)\b/i],
    "Industry standards": [/\b(iso|nist|fhir|hl7|itil|iec|standards?)\b/i],
  },
  "Functional Requirements": {
    "Business requirements": [/\b(revenue|kpi|business objective|goal|outcome|stakeholder value)\b/i],
    "User requirements": [/\b(user|customer|admin|operator|actor|persona|self-service)\b/i],
    "System/feature requirements": [/\b(system shall|feature|module|capability|function|process|automate)\b/i],
    "Interface requirements": [/\b(interface|ui|screen|dashboard|form|api integration|integration endpoint)\b/i],
  },
  "Non-Functional Requirements": {
    Performance: [/\b(latency|response time|throughput|performance|95th percentile|seconds?)\b/i],
    Scalability: [/\b(scale|scalability|concurrent users|horizontal|vertical scaling|elastic)\b/i],
    "Reliability & Availability": [/\b(uptime|availability|reliability|mttr|mtbf|fault tolerance|resilient)\b/i],
    Security: [/\b(security|encryption|auth|authentication|authorization|access control|vulnerability)\b/i],
    Usability: [/\b(usability|accessible|accessibility|wcag|user-friendly|intuitive)\b/i],
    Maintainability: [/\b(maintain|maintainability|modular|testability|refactor|supportability)\b/i],
    Portability: [/\b(portable|portability|cross-platform|os-agnostic|containerized)\b/i],
    Compatibility: [/\b(compatible|compatibility|browser support|interoperability|backward compatible)\b/i],
    Recoverability: [/\b(recover|recovery|backup|restore|rto|rpo|disaster)\b/i],
  },
};

const emptyBreakdown = () => {
  const out = {};
  Object.entries(TAXONOMY).forEach(([section, subtypes]) => {
    out[section] = {};
    subtypes.forEach((sub) => {
      out[section][sub] = [];
    });
  });
  return out;
};

const pickMatch = (text, section) => {
  const sectionRules = RULES[section] || {};
  for (const [sub, patterns] of Object.entries(sectionRules)) {
    if (patterns.some((p) => p.test(text))) return sub;
  }
  return null;
};

const classifyRequirement = (req, type) => {
  const text = `${req.description || ""} ${req.category || ""}`.toLowerCase();

  const prioritySections = [
    "Business Rules",
    "Constraints",
    "Transition Requirements",
    "Domain Requirements",
  ];

  for (const section of prioritySections) {
    const sub = pickMatch(text, section);
    if (sub) return { section, subtype: sub };
  }

  if (type === "functional") {
    return {
      section: "Functional Requirements",
      subtype: pickMatch(text, "Functional Requirements") || "System/feature requirements",
    };
  }

  return {
    section: "Non-Functional Requirements",
    subtype: pickMatch(text, "Non-Functional Requirements") || "Reliability & Availability",
  };
};

const flattenRequirements = (requirements) => {
  const functional = requirements?.functional_requirements ?? requirements?.functional ?? [];
  const nonFunctional =
    requirements?.non_functional_requirements ?? requirements?.nonFunctional ?? [];

  return [
    ...functional.map((r) => ({ ...r, __type: "functional" })),
    ...nonFunctional.map((r) => ({ ...r, __type: "nonFunctional" })),
  ];
};

const buildReportModel = (requirements) => {
  const all = flattenRequirements(requirements);
  const breakdown = emptyBreakdown();

  const detailed = all.map((req, index) => {
    const { section, subtype } = classifyRequirement(req, req.__type);
    const row = {
      id: req.id || `REQ-${index + 1}`,
      type: req.__type === "functional" ? "Functional" : "Non-Functional",
      section,
      subtype,
      description: req.description || "",
      category: req.category || "General",
      priority: req.priority || "Medium",
      confidence: typeof req.confidence === "number" ? req.confidence : null,
      ambiguous: !!req.ambiguity?.isAmbiguous,
    };

    breakdown[section][subtype].push(row);
    return row;
  });

  const subtypeTotal = Object.values(TAXONOMY).reduce((sum, s) => sum + s.length, 0);
  const coveredSubtypes = Object.values(breakdown).reduce(
    (sum, section) => sum + Object.values(section).filter((items) => items.length > 0).length,
    0
  );

  const avgConfidence =
    detailed.filter((d) => typeof d.confidence === "number").reduce((sum, d) => sum + d.confidence, 0) /
    Math.max(1, detailed.filter((d) => typeof d.confidence === "number").length);

  const summary = {
    total: detailed.length,
    functional: detailed.filter((d) => d.type === "Functional").length,
    nonFunctional: detailed.filter((d) => d.type === "Non-Functional").length,
    ambiguous: detailed.filter((d) => d.ambiguous).length,
    lowConfidence: detailed.filter((d) => typeof d.confidence === "number" && d.confidence < 70).length,
    subtypeCoverage: Math.round((coveredSubtypes / subtypeTotal) * 100),
    averageConfidence: Number.isFinite(avgConfidence) ? Math.round(avgConfidence) : null,
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    breakdown,
    details: detailed,
  };
};

const PROGRESS_META = [
  { key: "coverage", label: "Coverage", color: "bg-brand-500" },
  { key: "confidence", label: "Confidence", color: "bg-emerald-500" },
  { key: "ambiguity", label: "Ambiguity", color: "bg-amber-500" },
];

const AnalysisDashboard = ({ requirements, loading = false }) => {
  const [typeFilter, setTypeFilter] = useState("all");
  const [isDark, setIsDark] = useState(false);

  if (loading || !requirements) {
    return <DashboardSkeleton />;
  }

  const report = useMemo(() => buildReportModel(requirements), [requirements]);

  const filteredDetails = useMemo(() => {
    if (typeFilter === "all") return report.details;
    if (typeFilter === "functional") return report.details.filter((d) => d.type === "Functional");
    if (typeFilter === "non-functional") return report.details.filter((d) => d.type === "Non-Functional");
    if (typeFilter === "constraints") return report.details.filter((d) => d.section === "Constraints");
    if (typeFilter === "business-rules") {
      return report.details.filter((d) => d.section === "Business Rules");
    }
    return report.details;
  }, [report.details, typeFilter]);

  const typeCounts = useMemo(() => {
    const sectionCount = (section) => filteredDetails.filter((d) => d.section === section).length;
    return [
      { name: "Functional", count: filteredDetails.filter((d) => d.type === "Functional").length },
      { name: "Non-functional", count: filteredDetails.filter((d) => d.type === "Non-Functional").length },
      { name: "Constraints", count: sectionCount("Constraints") },
      { name: "Business rules", count: sectionCount("Business Rules") },
    ];
  }, [filteredDetails]);

  const subtypeDistribution = useMemo(() => {
    const map = new Map();
    filteredDetails.forEach((row) => {
      map.set(row.subtype, (map.get(row.subtype) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredDetails]);

  const confidenceTrend = useMemo(() => {
    return filteredDetails.map((row, idx) => ({
      name: row.id || `REQ-${idx + 1}`,
      confidence: typeof row.confidence === "number" ? row.confidence : 65,
      index: idx + 1,
    }));
  }, [filteredDetails]);

  const ambiguityPct = report.summary.total > 0
    ? Math.round((report.summary.ambiguous / report.summary.total) * 100)
    : 0;

  const progressValues = {
    coverage: report.summary.subtypeCoverage,
    confidence: report.summary.averageConfidence ?? 0,
    ambiguity: ambiguityPct,
  };

  const donutColors = [
    "#4f6ef7",
    "#2f84f7",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#f97316",
    "#06b6d4",
    "#84cc16",
  ];

  const handleDownloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reqai-analysis-report.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const metricCards = [
    { label: "Total Requirements", value: report.summary.total },
    { label: "Subtype Coverage", value: `${report.summary.subtypeCoverage}%` },
    { label: "Ambiguous", value: report.summary.ambiguous },
    { label: "Low Confidence", value: report.summary.lowConfidence },
    {
      label: "Avg Confidence",
      value: report.summary.averageConfidence !== null ? `${report.summary.averageConfidence}%` : "N/A",
    },
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-950">
        <DashboardCard className="bg-gradient-to-br from-brand-600 to-indigo-800 text-white dark:border-slate-700 dark:from-indigo-700 dark:to-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold">SRS Intelligence Dashboard</h3>
              <p className="mt-2 max-w-3xl text-sm text-indigo-100">
                Professional analytics for requirement classification, confidence quality, subtype
                coverage, and ambiguity risk across the uploaded SRS.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-medium">
                <Filter size={14} />
                <select
                  className="bg-transparent text-white outline-none"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all" className="text-slate-900">All</option>
                  <option value="functional" className="text-slate-900">Functional</option>
                  <option value="non-functional" className="text-slate-900">Non-functional</option>
                  <option value="constraints" className="text-slate-900">Constraints</option>
                  <option value="business-rules" className="text-slate-900">Business rules</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setIsDark((v) => !v)}
                className="rounded-xl bg-white/15 p-2 transition hover:bg-white/25"
                title="Toggle dashboard theme"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-indigo-50"
                onClick={handleDownloadReport}
              >
                <Download size={14} />
                Generate Analysis Report
              </button>
            </div>
          </div>
        </DashboardCard>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatsCard
            label="Total Requirements"
            value={metricCards[0].value}
            hint="All classified records"
            icon={FileText}
          />
          <StatsCard
            label="Subtype Coverage"
            value={metricCards[1].value}
            hint="Taxonomy section coverage"
            icon={Layers}
            tone="success"
          />
          <StatsCard
            label="Ambiguous"
            value={metricCards[2].value}
            hint="Needs measurable rewrite"
            icon={ShieldAlert}
            tone="warning"
          />
          <StatsCard
            label="Low Confidence"
            value={metricCards[3].value}
            hint="Below 70% confidence"
            icon={Activity}
            tone="danger"
          />
          <StatsCard
            label="Avg Confidence"
            value={metricCards[4].value}
            hint="Across visible requirements"
            icon={Activity}
            tone="brand"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <ChartCard
            title="Requirement Type Breakdown"
            subtitle="Functional vs Non-functional vs constraints/business rules"
            className="xl:col-span-6"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeCounts}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} />
                <YAxis tick={{ fill: "#475569", fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }}
                  cursor={{ fill: "rgba(79, 110, 247, 0.08)" }}
                />
                <Bar dataKey="count" fill="#4f6ef7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Subtype Distribution"
            subtitle="Top subtype concentration with percentages"
            className="xl:col-span-6"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 8, left: 8, bottom: 52 }}>
                <Pie
                  data={subtypeDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="40%"
                  innerRadius={46}
                  outerRadius={78}
                  label={({ percent }) => `${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {subtypeDistribution.map((entry, idx) => (
                    <Cell key={entry.name} fill={donutColors[idx % donutColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }} />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  iconSize={10}
                  height={56}
                  wrapperStyle={{ left: 8, right: 8, bottom: 18, lineHeight: "20px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Confidence Trend"
            subtitle="Confidence progression across analyzed requirements"
            className="xl:col-span-8"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={confidenceTrend}>
                <defs>
                  <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="index" tick={{ fill: "#475569", fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }} />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  stroke="#4f6ef7"
                  fill="url(#confidenceGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <DashboardCard
            title="Quality Progress"
            subtitle="Coverage, confidence, and ambiguity indicators"
            className="xl:col-span-4"
          >
            <div className="space-y-4">
              {PROGRESS_META.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="font-semibold text-slate-900">{progressValues[item.key]}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${item.color}`}
                      style={{ width: `${Math.max(0, Math.min(100, progressValues[item.key]))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Object.entries(TAXONOMY).map(([section, subtypes]) => (
            <DashboardCard key={section} title={section} subtitle="Subtype occurrence summary">
              <ul className="space-y-2">
                {subtypes.map((subtype) => {
                  const count = report.breakdown?.[section]?.[subtype]?.length || 0;
                  return (
                    <li
                      key={`${section}-${subtype}`}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      <span>{subtype}</span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </DashboardCard>
          ))}
        </div>

        <DashboardCard
          title="Requirement Classification Table"
          subtitle="Interactive table with striped rows and hover insights"
          className="mt-4"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  {["ID", "Type", "Section", "Subtype", "Priority", "Confidence", "Description"].map((h) => (
                    <th
                      key={h}
                      className="sticky top-0 border-b border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDetails.map((row, idx) => (
                  <tr
                    key={`${row.id}-${idx}`}
                    className={`transition-colors hover:bg-indigo-50/70 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                  >
                    <td className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-brand-700">{row.id}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700">{row.type}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700">{row.section}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700">{row.subtype}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700">{row.priority}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700">
                      {row.confidence !== null ? `${row.confidence}%` : "N/A"}
                      {row.ambiguous ? (
                        <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Ambiguous
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-xl border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                      {row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
};

export default AnalysisDashboard;
