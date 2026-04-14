import React from "react";
import DashboardCard from "./DashboardCard";

const ChartCard = ({
  title,
  subtitle,
  children,
  rightSlot,
  className = "",
  contentClassName = "h-72",
}) => {
  return (
    <DashboardCard title={title} subtitle={subtitle} rightSlot={rightSlot} className={className}>
      <div className={contentClassName}>{children}</div>
    </DashboardCard>
  );
};

export default ChartCard;
