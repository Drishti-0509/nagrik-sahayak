import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AlertCircle } from 'lucide-react';

const priorityConfig = {
  Low: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    tKey: 'priorityLow',
  },
  Medium: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    tKey: 'priorityMedium',
  },
  High: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    tKey: 'priorityHigh',
  },
  Urgent: {
    bg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    tKey: 'priorityUrgent',
    pulse: true,
  },
};

const PriorityBadge = ({ priority }) => {
  const { t } = useLanguage();
  const config = priorityConfig[priority] || priorityConfig.Medium;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${config.bg}`}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2 mr-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
        </span>
      )}
      {!config.pulse && priority === 'High' && <AlertCircle className="w-3 h-3 text-amber-600" />}
      <span>{t(config.tKey, priority)}</span>
    </span>
  );
};

export default PriorityBadge;
