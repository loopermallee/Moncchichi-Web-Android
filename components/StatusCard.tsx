
import React from 'react';

interface StatusCardProps {
  label: string;
  value: string | number | React.ReactNode;
  subLabel?: string;
  icon?: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'error';
}

const StatusCard: React.FC<StatusCardProps> = ({ label, value, subLabel, icon, color = 'default' }) => {
  const borderColor = {
    default: 'border-moncchichi-border',
    success: 'border-moncchichi-success/50',
    warning: 'border-moncchichi-warning/50',
    error: 'border-moncchichi-error/50',
  }[color];

  const textColor = {
    default: 'text-moncchichi-text',
    success: 'text-moncchichi-success',
    warning: 'text-moncchichi-warning',
    error: 'text-moncchichi-error',
  }[color];

  return (
    <div className={`bg-moncchichi-surface rounded-xl p-3 border ${borderColor} flex flex-col justify-between min-h-[90px]`}>
      <div className="flex justify-between items-start">
        <span className="text-moncchichi-textSec text-[10px] font-bold uppercase tracking-wider">{label}</span>
        {icon && <div className={`${textColor} opacity-80 scale-75 origin-top-right`}>{icon}</div>}
      </div>
      <div className="mt-2">
        <div className={`text-lg font-semibold leading-tight ${textColor} truncate`}>{value}</div>
        {subLabel && <div className="text-moncchichi-textSec text-[10px] mt-1 truncate">{subLabel}</div>}
      </div>
    </div>
  );
};

export default StatusCard;
