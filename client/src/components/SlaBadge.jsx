import React from 'react';
import { Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const SlaBadge = ({ slaInfo, deadline, status }) => {
  const { t } = useLanguage();

  if (status === 'Resolved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{t('statusResolved')}</span>
      </span>
    );
  }

  if (status === 'Closed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{t('statusClosed')}</span>
      </span>
    );
  }

  if (status === 'Rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <XCircle className="w-3.5 h-3.5" />
        <span>{t('statusRejected')}</span>
      </span>
    );
  }

  let isOverdue = slaInfo?.isOverdue;
  let overdueHours = slaInfo?.overdueByHours;
  let hoursRemaining = slaInfo?.hoursRemaining;

  if (!slaInfo && deadline) {
    const deadlineMs = new Date(deadline).getTime();
    if (!Number.isNaN(deadlineMs)) {
      const diffMs = deadlineMs - Date.now();
      const roundedHours = Math.round(diffMs / (1000 * 60 * 60));
      isOverdue = diffMs < 0;
      overdueHours = isOverdue ? Math.abs(roundedHours) : 0;
      hoursRemaining = isOverdue ? 0 : roundedHours;
    }
  }

  if (!slaInfo && !deadline) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>—</span>
      </span>
    );
  }

  const safeOverdueHours = overdueHours || 0;
  const safeHoursRemaining = hoursRemaining ?? 0;

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
        <span>
          {t('slaOverdueBy')} {safeOverdueHours} {t('hours')}
        </span>
      </span>
    );
  }

  const isUrgentClock = safeHoursRemaining <= 24;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
        isUrgentClock
          ? 'bg-amber-50 text-amber-800 border-amber-300'
          : 'bg-slate-50 text-slate-700 border-slate-200'
      }`}
    >
      <Clock className={`w-3.5 h-3.5 ${isUrgentClock ? 'text-amber-600' : 'text-slate-500'}`} />
      <span>
        {safeHoursRemaining} {t('hours')} {t('slaRemaining')}
      </span>
    </span>
  );
};

export default SlaBadge;
