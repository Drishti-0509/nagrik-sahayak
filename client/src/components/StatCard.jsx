import React from 'react';

const StatCard = ({ title, value, icon: Icon, color = 'navy', subtitle, onClick }) => {
  const colorMap = {
    navy: 'bg-navy-50 text-navy-800 border-navy-200',
    teal: 'bg-teal-50 text-teal-800 border-teal-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const iconColorMap = {
    navy: 'text-navy-700 bg-navy-100',
    teal: 'text-teal-700 bg-teal-100',
    amber: 'text-amber-700 bg-amber-100',
    rose: 'text-rose-700 bg-rose-100',
    emerald: 'text-emerald-700 bg-emerald-100',
    blue: 'text-blue-700 bg-blue-100',
  };

  return (
    <div
      onClick={onClick}
      className={`civic-card p-5 relative overflow-hidden transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-slate-400' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 font-mono">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${iconColorMap[color] || iconColorMap.navy}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
