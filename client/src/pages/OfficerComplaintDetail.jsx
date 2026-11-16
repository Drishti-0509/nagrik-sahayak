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
  CheckCircle2,
  Send,
  Loader2,
  FileCheck2,
  Image as ImageIcon,
  UploadCloud,
  X,
  Star,
  UserCheck,
} from 'lucide-react';

const OFFICER_TRANSITIONS = {
  Submitted: ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'],
  Received: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'],
  'Under Review': ['Assigned', 'In Progress', 'Resolved', 'Rejected'],
  Assigned: ['Received', 'Under Review', 'In Progress', 'Resolved', 'Rejected'],
  'In Progress': ['Under Review', 'Assigned', 'Resolved', 'Rejected'],
  Reopened: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'],
};

const ADMIN_TRANSITIONS = {
  Submitted: ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  Received: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  'Under Review': ['Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  Assigned: ['Received', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  'In Progress': ['Under Review', 'Assigned', 'Resolved', 'Closed', 'Rejected'],
  Reopened: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  Resolved: ['Closed', 'Reopened', 'In Progress'],
  Closed: ['Reopened'],
  Rejected: ['Reopened', 'Under Review'],
};

const OfficerComplaintDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { fetchNotifications } = useNotifications();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status update form states
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionEvidence, setResolutionEvidence] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusErr, setStatusErr] = useState('');

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentErr, setCommentErr] = useState('');

  // Grievance claim state
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');
  const [claimErr, setClaimErr] = useState('');

  // Evidence state
  const [evidenceList, setEvidenceList] = useState([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const currentUserId = user?._id?.toString();
  const userDeptId = typeof user?.department === 'object' ? user?.department?._id?.toString() : user?.department?.toString();
  const complaintDeptId = typeof complaint?.department === 'object' ? complaint?.department?._id?.toString() : complaint?.department?.toString();

  const assignedOfficerId = complaint?.assignedOfficer
    ? (typeof complaint.assignedOfficer === 'object' ? complaint.assignedOfficer._id?.toString() : complaint.assignedOfficer.toString())
    : null;

  const isAssigned = Boolean(assignedOfficerId);
  const isAssignedToMe = Boolean(assignedOfficerId && currentUserId && assignedOfficerId === currentUserId);
  const isAssignedToOther = Boolean(assignedOfficerId && currentUserId && assignedOfficerId !== currentUserId);
  const isSameDepartment = Boolean(userDeptId && complaintDeptId && userDeptId === complaintDeptId);
  const canClaim = !isAssigned && isSameDepartment && user?.role === 'officer' && !['Closed', 'Resolved', 'Rejected'].includes(complaint?.status);

  const fetchComplaint = useCallback(async () => {
    try {
      const res = await api.get(`/complaints/${id}`);
      if (res.data.success) {
        setComplaint(res.data.complaint);
        setNewStatus('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Access denied or grievance not found.');
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
      console.warn('Failed to fetch evidence records:', err);
    } finally {
      setLoadingEvidence(false);
    }
  }, [id]);

  useEffect(() => {
    fetchComplaint();
    fetchEvidence();
  }, [fetchComplaint, fetchEvidence]);

  const handleResolutionEvidenceFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setStatusErr('Only JPEG, PNG, and WebP images are allowed for resolution proof.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusErr('Resolution proof image must be under 5MB.');
      e.target.value = '';
      return;
    }

    setStatusErr('');
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setResolutionEvidence(loadEvt.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!newStatus) {
      setStatusErr('Please select a valid target status.');
      return;
    }

    if (newStatus === 'Resolved' && !resolutionNotes.trim()) {
      setStatusErr('Please provide detailed Resolution Notes when marking a grievance as Resolved.');
      return;
    }

    setUpdatingStatus(true);
    setStatusMsg('');
    setStatusErr('');
    try {
      const payload = {
        status: newStatus,
        notes: statusNotes.trim(),
        resolutionNotes: resolutionNotes.trim(),
      };

      if (newStatus === 'Resolved' && resolutionEvidence) {
        payload.resolutionEvidence = resolutionEvidence;
      }

      const res = await api.put(`/complaints/${complaint._id}/status`, payload);

      if (res.data.success) {
        setStatusMsg(`Status updated successfully to "${newStatus}"`);
        setStatusNotes('');
        setResolutionNotes('');
        setResolutionEvidence('');
        await fetchComplaint();
        await fetchEvidence();
        fetchNotifications();
      }
    } catch (err) {
      setStatusErr(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    setCommentErr('');
    try {
      const res = await api.post(`/complaints/${complaint._id}/comments`, {
        message: commentText.trim(),
        isInternal,
      });

      if (res.data.success) {
        setCommentText('');
        setIsInternal(false);
        await fetchComplaint();
        fetchNotifications();
      }
    } catch (err) {
      setCommentErr(err.response?.data?.message || 'Failed to post remark');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleClaimComplaint = async () => {
    if (!complaint || claiming) return;

    setClaiming(true);
    setClaimMsg('');
    setClaimErr('');

    try {
      const targetDeptId = complaintDeptId || userDeptId;
      const res = await api.put(`/complaints/${complaint._id}/assign`, {
        officerId: user._id,
        departmentId: targetDeptId,
        notes: 'Officer self-claimed grievance from department pool',
      });

      if (res.data.success) {
        setClaimMsg('Grievance successfully claimed and assigned to you!');
        await fetchComplaint();
        fetchNotifications();
      } else {
        setClaimErr(res.data.message || 'Unable to claim grievance.');
      }
    } catch (err) {
      setClaimErr(err.response?.data?.message || 'Failed to claim grievance. Please try again.');
    } finally {
      setClaiming(false);
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
      <div className="max-w-xl mx-auto my-12 p-8 civic-card text-center space-y-4">
        <h2 className="text-base font-bold text-slate-800">Authorization Restriction</h2>
        <p className="text-xs text-slate-600">{error || 'Grievance not found.'}</p>
        <Link
          to="/officer/assigned"
          className="inline-block px-4 py-2 rounded-lg bg-navy-800 text-white text-xs font-semibold"
        >
          Return to Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar */}
      <div className="civic-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-navy-950">
              {complaint.trackingId}
            </span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            {complaint.isEscalated && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                ESCALATED
              </span>
            )}
            {isAssignedToMe ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{t('assignedToMe', 'Assigned to Me')}</span>
              </span>
            ) : isAssignedToOther ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>Assigned: {complaint.assignedOfficer?.name || 'Another Officer'}</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t('unassignedPool', 'Unassigned Pool')}</span>
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-slate-900">{complaint.title}</h1>
        </div>

        <SlaBadge
          slaInfo={complaint.slaInfo}
          deadline={complaint.slaDeadline}
          status={complaint.status}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details, Action Form, Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prominent Claim Grievance Banner for Unassigned Department Tickets */}
          {canClaim && (
            <div className="civic-card p-6 bg-gradient-to-r from-teal-50/90 via-emerald-50/60 to-white border-2 border-teal-500 shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-teal-950 font-bold text-sm">
                    <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Unassigned Grievance in {complaint.department?.name || 'Department Pool'}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This grievance belongs to your department pool and does not have an assigned officer yet. Claim ownership to officially take charge of investigation and resolution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClaimComplaint}
                  disabled={claiming}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {claiming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Claiming Grievance...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>{t('claimGrievance', 'Claim Grievance / Assign to Me')}</span>
                    </>
                  )}
                </button>
              </div>

              {claimErr && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{claimErr}</span>
                </div>
              )}
            </div>
          )}

          {claimMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{claimMsg}</span>
            </div>
          )}

          {/* Officer Redressal Action Box */}
          <div className="civic-card p-6 border-l-4 border-l-teal-600 space-y-4">
            <h2 className="text-sm font-bold text-navy-950 uppercase tracking-wider flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-teal-600" />
              <span>{t('updateStatusTitle')}</span>
            </h2>

            {statusMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusMsg}</span>
              </div>
            )}

            {statusErr && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{statusErr}</span>
              </div>
            )}

            {user?.role === 'officer' && ['Closed', 'Resolved', 'Rejected'].includes(complaint.status) ? (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">
                  Status Locked ({complaint.status})
                </p>
                <p>
                  Officers cannot modify complaints that are already {complaint.status}. Only the citizen can close or request reopening, or an administrator can intervene.
                </p>
              </div>
            ) : (
            <form onSubmit={handleStatusUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {t('selectNewStatus')}
                </label>
                <select
                  required
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="">-- Select Next Status --</option>
                  {((user?.role === 'admin'
                    ? ADMIN_TRANSITIONS[complaint.status]
                    : OFFICER_TRANSITIONS[complaint.status]) || []
                  ).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {t('progressNotes')}
                </label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Record official actions taken, field team deployed, or status findings..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {newStatus === 'Resolved' && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-3">
                  <div>
                    <label className="block font-bold text-emerald-900">
                      {t('resolutionNotesLabel')} *
                    </label>
                    <p className="text-[11px] text-emerald-700 mb-1">
                      Please describe the resolution clearly. This note will appear on the citizen's resolution certificate.
                    </p>
                    <textarea
                      required
                      rows={2}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="e.g. Pipeline replacement completed and water pressure restored. Tested on site."
                      className="w-full p-2.5 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    />
                  </div>

                  {/* Resolution Proof Upload */}
                  <div className="space-y-1.5 pt-2 border-t border-emerald-200/60">
                    <label className="block font-bold text-emerald-900">
                      {t('resolutionEvidenceUpload')}
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 font-semibold text-xs transition shadow-sm">
                        <UploadCloud className="w-4 h-4 text-emerald-700" />
                        <span>Upload Work Proof Image</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleResolutionEvidenceFile}
                          className="hidden"
                        />
                      </label>
                      {resolutionEvidence && (
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-md border border-emerald-300">
                          <img
                            src={resolutionEvidence}
                            alt="Resolution Proof"
                            className="h-10 w-16 object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={() => setResolutionEvidence('')}
                            className="text-rose-600 hover:text-rose-800 text-[11px] font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={updatingStatus}
                className="px-5 py-2.5 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {updatingStatus ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving update...</span>
                  </>
                ) : (
                  <span>{t('btnUpdateStatus')}</span>
                )}
              </button>
            </form>
            )}
          </div>

          {/* Grievance Description & Location */}
          <div className="civic-card p-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Citizen Grievance Submission
            </h3>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {complaint.description}
            </p>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Incident Location: </span>
                <span>{complaint.location?.address}</span>
                {complaint.location?.pincode && <span> (PIN: {complaint.location.pincode})</span>}
              </div>
            </div>

            {/* Citizen Uploaded Image Evidence */}
            {complaint.evidenceImage && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <ImageIcon className="w-4 h-4 text-teal-600" />
                  <span>Citizen Uploaded Evidence Photo</span>
                </span>
                <div className="max-w-sm rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                  <img
                    src={complaint.evidenceImage}
                    alt="Citizen grievance proof"
                    className="w-full max-h-56 object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Comments & Remarks Section */}
          <div className="civic-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <span>Communication History & Remarks</span>
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {!complaint.comments || complaint.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No remarks posted yet.</p>
              ) : (
                complaint.comments.map((cm) => (
                  <div
                    key={cm._id}
                    className={`p-3 rounded-lg text-xs space-y-1 ${
                      cm.isInternal
                        ? 'bg-amber-50 border border-amber-200'
                        : cm.userRole === 'citizen'
                        ? 'bg-blue-50/60 border border-blue-100'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{cm.userName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-white border">
                          {cm.userRole}
                        </span>
                        {cm.isInternal && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                            INTERNAL NOTE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(cm.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-wrap">{cm.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Officer Comment Form */}
            <form onSubmit={handleCommentSubmit} className="pt-3 border-t border-slate-100 space-y-2">
              {commentErr && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5 border border-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{commentErr}</span>
                </div>
              )}
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add remark or note for record..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>{t('markInternalNote')}</span>
                </label>

                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Remark</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Citizen Details, Department, Timeline */}
        <div className="space-y-6">
          {/* Department & Officer Ownership Card */}
          <div className="civic-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-teal-600" />
              <span>Department & Ownership</span>
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Department:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <span>{complaint.department?.name || 'General Municipal'}</span>
                  {complaint.department?.code && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                      {complaint.department.code}
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Assigned Officer:</span>
                {isAssignedToMe ? (
                  <div className="mt-1.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-950">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs text-emerald-900">{t('assignedToMe', 'Assigned to Me')}</p>
                      <p className="text-[11px] text-emerald-700">{user?.name}</p>
                      {user?.email && (
                        <p className="text-[10px] text-emerald-600 font-mono">{user.email}</p>
                      )}
                    </div>
                  </div>
                ) : isAssignedToOther ? (
                  <div className="mt-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-slate-800">
                    <User className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">{complaint.assignedOfficer?.name || 'Assigned Officer'}</p>
                      {complaint.assignedOfficer?.email && (
                        <p className="text-[11px] text-slate-500 font-mono">{complaint.assignedOfficer.email}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 space-y-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{t('unassignedPool', 'Unassigned Department Pool')}</span>
                    </div>
                    {canClaim ? (
                      <button
                        type="button"
                        onClick={handleClaimComplaint}
                        disabled={claiming}
                        className="w-full py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {claiming ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Claiming...</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{t('claimGrievanceShort', 'Claim Grievance')}</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <p className="text-[11px] text-amber-800">
                        Pending assignment by department head or administrator.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Intelligent SLA Prediction (AI Advisory) */}
          {complaint.predictedSla?.predictedHours && (
            <div className="civic-card p-5 bg-blue-50/70 border border-blue-200 text-xs space-y-2">
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
                <span className="text-lg font-extrabold text-blue-900">
                  ~{complaint.predictedSla.predictedHours} hrs
                </span>
                <span className="text-slate-600 text-xs">
                  ({complaint.predictedSla.predictedDays} {complaint.predictedSla.predictedDays === 1 ? 'day' : 'days'})
                </span>
              </div>
              <p className="text-[10px] text-blue-800/80 leading-tight">
                {t('statutorySlaNotice')}
              </p>
            </div>
          )}

          <div className="civic-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Complainant Details
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block">Citizen Name:</span>
                <span className="font-bold text-slate-900">{complaint.citizen?.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Phone:</span>
                <span className="font-mono text-slate-800">{complaint.citizen?.phone || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Email:</span>
                <span className="font-mono text-slate-800">{complaint.citizen?.email}</span>
              </div>
            </div>
          </div>

          {/* Resolution History & Evidence */}
          {(evidenceList.some((e) => e.evidenceType === 'officer_resolution') ||
            complaint.resolutionNotes ||
            complaint.resolutionEvidence) && (
            <div className="civic-card p-5 space-y-4 bg-emerald-50/60 border border-emerald-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{t('resolutionHistoryTitle', 'Resolution History & Evidence')}</span>
                </h3>
                {complaint.resolutionCycleCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {t('resolutionCycle', 'Cycle')} {complaint.resolutionCycleCount}
                  </span>
                )}
              </div>

              {/* Multi-cycle evidence list if available */}
              {evidenceList.filter((e) => e.evidenceType === 'officer_resolution').length > 0 ? (
                <div className="space-y-3">
                  {evidenceList
                    .filter((e) => e.evidenceType === 'officer_resolution')
                    .map((item, idx) => (
                      <div
                        key={item._id || idx}
                        className="p-3 bg-white rounded-lg border border-emerald-100 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] text-emerald-900 border-b border-emerald-50 pb-1.5">
                          <span className="font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            {t('resolutionCycle', 'Resolution Cycle')} #{item.cycleNumber || idx + 1}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                          </span>
                        </div>

                        {item.caption && (
                          <p className="text-xs text-slate-700 leading-relaxed italic bg-emerald-50/40 p-2 rounded">
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
                              className="w-full max-h-48 object-cover rounded-md border border-emerald-200 group-hover:opacity-95 transition"
                            />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition rounded-md flex items-center justify-center text-white text-xs font-semibold">
                              {t('viewFullImage', 'View Full Image')}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>
                            {item.uploadedBy?.name
                              ? `Recorded by ${item.uploadedBy.name}`
                              : 'Recorded by Officer'}
                          </span>
                          {item.fileSizeBytes && (
                            <span>{(item.fileSizeBytes / 1024).toFixed(1)} KB</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                /* Fallback for legacy complaints without separate Evidence records */
                <div className="space-y-2">
                  {complaint.resolutionNotes && (
                    <p className="text-xs text-emerald-900 bg-white p-2.5 rounded-lg border border-emerald-100 leading-relaxed">
                      {complaint.resolutionNotes}
                    </p>
                  )}
                  {complaint.resolutionEvidence && (
                    <div
                      className="relative group cursor-pointer"
                      onClick={() =>
                        setPreviewImage({
                          dataUrl: complaint.resolutionEvidence,
                          caption: complaint.resolutionNotes,
                          cycleNumber: 1,
                        })
                      }
                    >
                      <img
                        src={complaint.resolutionEvidence}
                        alt="Work Evidence"
                        className="w-full max-h-48 object-cover rounded-lg border border-emerald-200 shadow-sm"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                        {t('viewFullImage', 'View Full Image')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Citizen Feedback Rating if Closed */}
          {complaint.citizenFeedback && complaint.citizenFeedback.rating && (
            <div className="civic-card p-5 space-y-2 bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Citizen Satisfaction Feedback
              </h3>
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
                <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-100">
                  "{complaint.citizenFeedback.comment}"
                </p>
              )}
            </div>
          )}

          <div className="civic-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('timelineTitle')}
            </h3>
            <TimelineView timeline={complaint.timeline} />
          </div>
        </div>
      </div>

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
                  : t('resolutionEvidenceTitle', 'Official Resolution Evidence')}
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
                <span className="font-semibold block text-slate-900 mb-0.5">Notes:</span>
                <p className="leading-relaxed">{previewImage.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerComplaintDetail;
