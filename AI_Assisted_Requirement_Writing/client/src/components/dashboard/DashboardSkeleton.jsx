import React from "react";

const PulseBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />
);

const DashboardSkeleton = () => {
  return (
    <div className="space-y-4">
      <PulseBlock className="h-24 w-full" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <PulseBlock className="h-24" />
        <PulseBlock className="h-24" />
        <PulseBlock className="h-24" />
        <PulseBlock className="h-24" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PulseBlock className="h-80" />
        <PulseBlock className="h-80" />
      </div>
      <PulseBlock className="h-96" />
    </div>
  );
};

export default DashboardSkeleton;
