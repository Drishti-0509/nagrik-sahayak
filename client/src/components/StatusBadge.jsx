import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const statusConfig = {
  Submitted: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    tKey: 'statusSubmitted',
  },
  Received: {
    bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500',
    tKey: 'statusReceived',
  },
  'Under Review': {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    tKey: 'statusUnderReview',
  },
  Assigned: {
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    tKey: 'statusAssigned',
  },
  'In Progress': {
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    tKey: 'statusInProgress',
  },
  Resolved: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    tKey: 'statusResolved',
  },
  Closed: {
    bg: 'bg-slate-100 text-slate-800 border-slate-300',
    dot: 'bg-slate-600',
    tKey: 'statusClosed',
  },
  Rejected: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    tKey: 'statusRejected',
  },
  Reopened: {
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    tKey: 'statusReopened',
  },
};

const StatusBadge = ({ status }) => {
  const { t } = useLanguage();
  const config = statusConfig[status] || statusConfig.Submitted;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{t(config.tKey, status)}</span>
    </span>
  );
};

export default StatusBadge;
