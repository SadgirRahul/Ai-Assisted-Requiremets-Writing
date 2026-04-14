import React from "react";
import DashboardCard from "./DashboardCard";

const StatsCard = ({ label, value, hint, icon: Icon, tone = "brand" }) => {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  };

  return (
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={`rounded-xl p-2 ${tones[tone] || tones.brand}`}>
            <Icon size={18} strokeWidth={2.1} />
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
};

export default StatsCard;
