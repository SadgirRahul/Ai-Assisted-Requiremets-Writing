import React from "react";

const DashboardCard = ({ title, subtitle, rightSlot, children, className = "" }) => {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition-transform duration-200 hover:-translate-y-0.5 ${className}`}
    >
      {(title || subtitle || rightSlot) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h3 className="text-sm font-semibold text-slate-900">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {rightSlot ? <div>{rightSlot}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
};

export default DashboardCard;
