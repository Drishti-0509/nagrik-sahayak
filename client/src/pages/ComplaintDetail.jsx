import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import SlaBadge from '../components/SlaBadge';
import TimelineView from '../components/TimelineView';
import {
  Shield,
  MapPin,
  Calendar,
  Clock,
  User,
  Building2,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Send,
  Loader2,
  AlertCircle,
  FileText,
  Star,
  Image as ImageIcon,
  X,
  History,
} from 'lucide-react';

const ComplaintDetail = () => {
  const { id } = useParams();
  const { user, isCitizen, isOfficer, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { fetchNotifications } = useNotifications();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');

  // Reopen, Close & Feedback, Escalate modals / form states
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  // Evidence history state
  const [evidenceList, setEvidenceList] = useState([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchComplaintDetails = useCallback(async () => {
    try {
      const res = await api.get(`/complaints/${id}`);
      if (res.data.success) {
        setComplaint(res.data.complaint);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to retrieve grievance details or access is unauthorized.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEvidence = useCallback(async () => {
    try {
      setLoadingEvidence(true);
      const res = await api.get(`/complaints/${id}/evidence`);
      if (res.data.success) {
        setEvidenceList(res.data.evidence || []);
      }
    } catch (err) {
      console.warn('Failed to fetch evidence records for citizen view:', err);
    } finally {
      setLoadingEvidence(false);
    }
  }, [id]);

  useEffect(() => {
    fetchComplaintDetails();
    fetchEvidence();
  }, [fetchComplaintDetails, fetchEvidence]);

  // Handle posting follow-up comment
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setCommentSubmitting(true);
    setCommentError('');
    try {
      const res = await api.post(`/complaints/${complaint._id}/comments`, {
        message: newComment.trim(),
        isInternal: isInternalComment,
      });

      if (res.data.success) {
        setNewComment('');
        setIsInternalComment(false);
        await fetchComplaintDetails();
        fetchNotifications();
      }
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Failed to submit comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Handle citizen requesting to reopen complaint
  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;

    setActionLoading(true);
    setActionError('');
    try {
      const res = await api.put(`/complaints/${complaint._id}/status`, {
        status: 'Reopened',
        notes: reopenReason.trim(),
      });

      if (res.data.success) {
        setShowReopenModal(false);
        setReopenReason('');
        await fetchComplaintDetails();
        await fetchEvidence();
        fetchNotifications();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reopen grievance');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle citizen accepting resolution and closing grievance with rating
  const handleCloseSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      const res = await api.put(`/complaints/${complaint._id}/status`, {
        status: 'Closed',
        rating: feedbackRating,
        comment: feedbackComment.trim(),
      });

      if (res.data.success) {
        setShowCloseModal(false);
        setFeedbackComment('');
        await fetchComplaintDetails();
        await fetchEvidence();
        fetchNotifications();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to close grievance');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle escalation
  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      const res = await api.put(`/complaints/${complaint._id}/escalate`, {
        reason: escalateReason.trim() || 'Citizen requested escalation due to breach or delay',
      });

      if (res.data.success) {
        setShowEscalateModal(false);
        setEscalateReason('');
        await fetchComplaintDetails();
        fetchNotifications();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to escalate');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500">{t('loading')}</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 civic-card text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
        <p className="text-xs text-slate-600">{error || 'Grievance not found.'}</p>
        <Link
          to="/"
          className="inline-block px-4 py-2 rounded-lg bg-navy-800 text-white text-xs font-semibold hover:bg-navy-900"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const isResolved = complaint.status === 'Resolved';
  const isClosed = complaint.status === 'Closed';
  const isResolvedOrRejected = ['Resolved', 'Rejected', 'Closed'].includes(complaint.status);
  const complaintCitizenId = (complaint.citizen?._id || complaint.citizen)?.toString();
  const isOwnerCitizen = Boolean(isCitizen && user?._id && complaintCitizenId === user._id.toString());
  const reopenEligible = complaint.reopenInfo ? complaint.reopenInfo.eligible : true;
  const canReopen = isOwnerCitizen && isResolvedOrRejected && reopenEligible;
  const reopenExpired = isOwnerCitizen && isResolvedOrRejected && complaint.reopenInfo && !complaint.reopenInfo.eligible;
  const canClose = isOwnerCitizen && isResolved;
  const isOverdue = complaint.slaInfo?.isOverdue;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner with Tracking Reference */}
      <div className="civic-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-navy-950">
              {complaint.trackingId}
            </span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            {complaint.isEscalated && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
                {t('escalatedBadge')}
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">{complaint.title}</h1>
        </div>

        {/* SLA Status & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <SlaBadge
            slaInfo={complaint.slaInfo}
            deadline={complaint.slaDeadline}
            status={complaint.status}
          />

          {canClose && (
            <button
              type="button"
              onClick={() => {
                setActionError('');
                setShowCloseModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('satisfiedWithResolution')}</span>
            </button>
          )}

          {canReopen && (
            <button
              type="button"
              onClick={() => {
                setActionError('');
                setShowReopenModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('btnReopen')}</span>
            </button>
          )}

          {reopenExpired && (
            <span
              title={complaint.reopenInfo?.reason || 'Reopen window expired after 7 days'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-xs font-medium"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Reopen window expired (7-day limit)</span>
            </span>
          )}

          {(isOfficer || isAdmin) && (
            <Link
              to={`/officer/complaints/${complaint._id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Officer Resolution Console →</span>
            </Link>
          )}

          {!complaint.isEscalated && !isResolvedOrRejected && (isOverdue || isOwnerCitizen) && (
            <button
              type="button"
              onClick={() => {
                setActionError('');
                setShowEscalateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t('btnEscalate')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout: Main Details & Sidebar Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Description, Location, AI Analysis, Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detailed Description */}
          <div className="civic-card p-6 space-y-3">
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Grievance Description
            </h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {complaint.description}
            </p>

            {/* Location block */}
            <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Incident Location:</span>
                <span>{complaint.location?.address}</span>
                {complaint.location?.pincode && (
                  <span className="ml-1 text-slate-500 font-mono">
                    (PIN: {complaint.location.pincode})
                  </span>
                )}
              </div>
            </div>

            {/* Citizen Uploaded Image Evidence */}
            {complaint.evidenceImage && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-teal-600" />
                  <span>{t('evidenceProvidedByCitizen')}</span>
                </span>
                <div
                  className="max-w-md overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm relative group cursor-pointer"
                  onClick={() =>
                    setPreviewImage({
                      dataUrl: complaint.evidenceImage,
                      caption: 'Citizen uploaded grievance photo',
                    })
                  }
                >
                  <img
                    src={complaint.evidenceImage}
                    alt="Citizen grievance evidence"
                    className="w-full max-h-72 object-cover rounded-lg group-hover:opacity-95 transition"
                  />
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                    {t('viewFullImage', 'View Full Image')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Civic Recommendation Card (if present) */}
          {complaint.aiAnalysis && (
            <div className="civic-card p-6 bg-gradient-to-br from-teal-50/50 to-slate-50 border-teal-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>{t('aiSuggestionTitle')}</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                  Confidence: {Math.round((complaint.aiAnalysis.confidence || 0.85) * 100)}%
                </span>
              </div>

              {complaint.aiAnalysis.summary && (
                <p className="text-xs text-slate-700 italic">
                  "{complaint.aiAnalysis.summary}"
                </p>
              )}

              {complaint.aiAnalysis.nextAction && (
                <div className="text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Recommended Action: </span>
                  <span>{complaint.aiAnalysis.nextAction}</span>
                </div>
              )}

              {complaint.aiAnalysis.isFallback && (
                <p className="text-[10px] text-amber-800 flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>{t('aiFallbackNotice')}</span>
                </p>
              )}
            </div>
          )}

          {/* Comments & Remarks Section */}
          <div className="civic-card p-6 space-y-5">
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <span>{t('commentsTitle')}</span>
            </h2>

            {/* Existing Comments List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {!complaint.comments || complaint.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No remarks posted yet.</p>
              ) : (
                complaint.comments.map((cm) => (
                  <div
                    key={cm._id}
                    className={`p-3.5 rounded-xl text-xs space-y-1.5 ${
                      cm.userRole === 'citizen'
                        ? 'bg-blue-50/60 border border-blue-100'
                        : cm.isInternal
                        ? 'bg-amber-50/70 border border-amber-200'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{cm.userName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-white border border-slate-200">
                          {cm.userRole}
                        </span>
                        {cm.isInternal && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                            INTERNAL NOTE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(cm.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' • '}
                        {new Date(cm.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {cm.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Post comment form */}
            <form onSubmit={handleCommentSubmit} className="pt-3 border-t border-slate-100 space-y-2">
              {commentError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5 border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{commentError}</span>
                </div>
              )}
              <textarea
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('addCommentPlaceholder')}
                className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />

              <div className="flex items-center justify-between">
                {/* Officers / Admins can toggle internal comment */}
                {!isCitizen ? (
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>{t('markInternalNote')}</span>
                  </label>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  disabled={commentSubmitting || !newComment.trim()}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {commentSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{t('btnPostComment')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Department, Officer, Timeline, Resolution */}
        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="civic-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Jurisdiction & Accountability
            </h3>

            {/* Department */}
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  {t('assignedDept')}
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {complaint.department?.name || t('unassigned')}
                </span>
              </div>
            </div>

            {/* Officer */}
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  {t('investigatingOfficer')}
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {complaint.assignedOfficer?.name || t('unassigned')}
                </span>
                {complaint.assignedOfficer?.email && (
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {complaint.assignedOfficer.email}
                  </span>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  {t('filedOn')}
                </span>
                <span className="text-xs text-slate-800">
                  {new Date(complaint.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Intelligent SLA Prediction (AI Advisory) */}
            {complaint.predictedSla?.predictedHours && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('slaPredictedTitle')}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {complaint.predictedSla.confidenceLevel || 'High'} Confidence
                  </span>
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-base font-extrabold text-blue-900">
                    ~{complaint.predictedSla.predictedHours} hrs
                  </span>
                  <span className="text-slate-600 text-[11px]">
                    ({complaint.predictedSla.predictedDays} {complaint.predictedSla.predictedDays === 1 ? 'day' : 'days'})
                  </span>
                </div>
                <p className="text-[10px] text-blue-800/80 leading-tight">
                  {t('statutorySlaNotice')}
                </p>
              </div>
            )}

            {/* Active Resolution Certificate & Evidence */}
            {(complaint.resolutionNotes || complaint.resolutionEvidence) &&
              ['Resolved', 'Closed'].includes(complaint.status) && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2.5">
                  <span className="font-bold text-emerald-950 block flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resolution Certificate:</span>
                  </span>
                  {complaint.resolutionNotes && (
                    <p className="text-emerald-900 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-emerald-100">
                      {complaint.resolutionNotes}
                    </p>
                  )}
                  {complaint.resolutionEvidence && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-emerald-800 block">
                        {t('resolutionEvidenceTitle')}
                      </span>
                      <div
                        className="relative group cursor-pointer"
                        onClick={() =>
                          setPreviewImage({
                            dataUrl: complaint.resolutionEvidence,
                            caption: complaint.resolutionNotes,
                            title: t('resolutionEvidenceTitle'),
                          })
                        }
                      >
                        <img
                          src={complaint.resolutionEvidence}
                          alt="Official Resolution Evidence"
                          className="w-full max-h-52 object-cover rounded-lg border border-emerald-200 shadow-sm group-hover:opacity-95 transition"
                        />
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                          {t('viewFullImage', 'View Full Image')}
                        </div>
                      </div>
                    </div>
                  )}
                  {complaint.resolvedAt && (
                    <span className="text-[10px] text-emerald-700 block mt-1 font-medium">
                      Resolved on {new Date(complaint.resolvedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

            {/* Historical Resolution Evidence (visible when past resolution cycles exist) */}
            {(() => {
              const officerEvidence = evidenceList.filter((e) => e.evidenceType === 'officer_resolution');
              const isCurrentlyResolved = ['Resolved', 'Closed'].includes(complaint.status);
              const historicalRecords = officerEvidence.filter((item) =>
                isCurrentlyResolved
                  ? item.cycleNumber < (complaint.resolutionCycleCount || 1)
                  : true
              );

              if (historicalRecords.length === 0) return null;

              return (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-3">
                  <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-600" />
                    <span>{t('historicalResolutionEvidence', 'Previous Resolution Attempts & Proof')}</span>
                  </span>
                  <div className="space-y-2.5">
                    {historicalRecords.map((item, idx) => (
                      <div
                        key={item._id || idx}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-800">
                          <span className="font-semibold text-slate-700">
                            {t('resolutionCycle', 'Cycle')} #{item.cycleNumber || idx + 1}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                        {item.uploadedBy?.name && (
                          <span className="text-[10px] text-slate-500 block">
                            Resolved by: {item.uploadedBy.name}
                          </span>
                        )}
                        {item.caption && (
                          <p className="text-[11px] text-slate-600 italic leading-relaxed">
                            "{item.caption}"
                          </p>
                        )}
                        {item.dataUrl && (
                          <div
                            className="relative group cursor-pointer"
                            onClick={() => setPreviewImage(item)}
                          >
                            <img
                              src={item.dataUrl}
                              alt={`Resolution proof cycle ${item.cycleNumber}`}
                              className="w-full max-h-36 object-cover rounded border border-slate-200 group-hover:opacity-95 transition"
                            />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition rounded flex items-center justify-center text-white text-xs font-semibold">
                              {t('viewFullImage', 'View Full Image')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Citizen Feedback Rating Card if Closed */}
            {complaint.citizenFeedback && complaint.citizenFeedback.rating && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-700" />
                  <span>Citizen Satisfaction Feedback</span>
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= complaint.citizenFeedback.rating
                          ? 'text-amber-500 fill-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-xs font-bold text-slate-800">
                    {complaint.citizenFeedback.rating} / 5
                  </span>
                </div>
                {complaint.citizenFeedback.comment && (
                  <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-100">
                    "{complaint.citizenFeedback.comment}"
                  </p>
                )}
                {complaint.closedAt && (
                  <span className="text-[10px] text-slate-500 block">
                    Closed on {new Date(complaint.closedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Timeline Audit History */}
          <div className="civic-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('timelineTitle')}
            </h3>
            <TimelineView timeline={complaint.timeline} />
          </div>
        </div>
      </div>

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-600" />
              <span>{t('reopenTitle')}</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('reopenPrompt')} Please explain why the resolution was incomplete or unsatisfactory.
            </p>
            {actionError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5 border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
            <textarea
              required
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. The leak was only temporarily covered and water started overflowing again..."
              className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={actionLoading || !reopenReason.trim()}
                onClick={handleReopenSubmit}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs disabled:opacity-50"
              >
                {actionLoading ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-rose-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Escalate Grievance to Senior Administration</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This grievance will be flagged with high-visibility priority on the Chief Administrative oversight dashboard.
            </p>
            {actionError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5 border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
            <textarea
              rows={3}
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="State reason for escalation (e.g. statutory deadline breached without ground response)..."
              className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEscalateModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleEscalateSubmit}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs disabled:opacity-50"
              >
                {actionLoading ? 'Escalating...' : 'Confirm Escalation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close & Rate Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{t('satisfiedWithResolution')}</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('closeResolutionPrompt')}
            </p>
            {actionError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5 border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Star Rating Picker */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                {t('feedbackRatingPrompt')}
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="p-1 focus:outline-none hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= feedbackRating
                          ? 'text-amber-500 fill-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-700 ml-2">
                  {feedbackRating} / 5 Stars
                </span>
              </div>
            </div>

            {/* Optional Comment */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                {t('feedbackCommentPrompt')}
              </label>
              <textarea
                rows={3}
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="e.g. The leak was completely repaired and water pressure has returned to normal. Thank you!"
                className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleCloseSubmit}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t('closeComplaintBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Full-size image preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                {previewImage.cycleNumber
                  ? `${t('resolutionCycle', 'Resolution Cycle')} #${previewImage.cycleNumber} Proof`
                  : previewImage.title || t('resolutionEvidenceTitle', 'Official Resolution Evidence')}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-950/5">
              <img
                src={previewImage.dataUrl}
                alt="Full resolution preview"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
            {previewImage.caption && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-700">
                <span className="font-semibold block text-slate-900 mb-0.5">Notes / Caption:</span>
                <p className="leading-relaxed">{previewImage.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintDetail;
