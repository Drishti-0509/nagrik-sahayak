import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import StatusBadge from './StatusBadge';
import { User, Clock, Camera, X } from 'lucide-react';

const EVENT_TYPE_LABELS = {
  complaint_created: 'Submitted',
  department_assigned: 'Department Routed',
  officer_assigned: 'Officer Assigned',
  status_changed: 'Status Updated',
  progress_note: 'Progress Note',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
  reopened: 'Reopened',
  escalated: 'Escalated',
};

const TimelineView = ({ timeline = [] }) => {
  const { t } = useLanguage();
  const [activeEvidence, setActiveEvidence] = useState(null);

  if (!timeline || timeline.length === 0) {
    return <p className="text-sm text-slate-500 italic">No timeline records available.</p>;
  }

  return (
    <>
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {timeline.map((item, index) => {
          const isLatest = index === timeline.length - 1;
          const dateStr = item.timestamp
            ? new Date(item.timestamp).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';
          const eventLabel = item.eventType ? EVENT_TYPE_LABELS[item.eventType] : '';
          const detailText = item.description || item.notes;
          const evidenceObj = item.evidence && typeof item.evidence === 'object' ? item.evidence : null;
          const hasEvidence = Boolean(evidenceObj && evidenceObj.dataUrl);

          return (
            <div key={item._id || index} className="relative group">
              {/* Dot marker */}
              <div
                className={`absolute -left-6 top-1.5 flex items-center justify-center w-5 h-5 rounded-full border-2 bg-white ${
                  isLatest
                    ? 'border-teal-600 text-teal-600 ring-4 ring-teal-50'
                    : 'border-slate-300 text-slate-400'
                }`}
              >
                {isLatest ? (
                  <div className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-3.5 hover:bg-white transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    {eventLabel && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-600">
                        {eventLabel}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {item.changedByName || 'System'} ({item.changedByRole || 'admin'})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{dateStr}</span>
                  </div>
                </div>

                {detailText && (
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">
                    {detailText}
                  </p>
                )}

                {/* Evidence Indicator for resolved events */}
                {hasEvidence && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (evidenceObj && evidenceObj.dataUrl) {
                          setActiveEvidence(evidenceObj);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{t('timelineEvidenceAttached', 'Work Proof Attached')}</span>
                      {evidenceObj.cycleNumber && (
                        <span className="text-[10px] text-emerald-700 opacity-80">
                          (Cycle #{evidenceObj.cycleNumber})
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox / Modal for timeline evidence */}
      {activeEvidence && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-150"
          onClick={() => setActiveEvidence(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>
                  {activeEvidence.cycleNumber
                    ? `${t('resolutionCycle', 'Resolution Cycle')} #${activeEvidence.cycleNumber} Proof`
                    : 'Resolution Milestone Proof'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveEvidence(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-950/5">
              <img
                src={activeEvidence.dataUrl}
                alt="Timeline resolution evidence"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
            {activeEvidence.caption && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-700">
                <span className="font-semibold block text-slate-900 mb-0.5">Event Remarks:</span>
                <p className="leading-relaxed">{activeEvidence.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TimelineView;
