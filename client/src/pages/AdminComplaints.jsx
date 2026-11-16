import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import SlaBadge from '../components/SlaBadge';
import {
  Search,
  Filter,
  UserCheck,
  Building2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  CheckCircle2,
} from 'lucide-react';

const AdminComplaints = () => {
  const { t } = useLanguage();

  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Assignment Modal State
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [assignDept, setAssignDept] = useState('');
  const [assignOfficer, setAssignOfficer] = useState('');
  const [assignPriority, setAssignPriority] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Fetch departments & officers list
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [deptRes, officerRes] = await Promise.all([
          api.get('/departments'),
          api.get('/users/officers/active'),
        ]);
        if (deptRes.data.success) setDepartments(deptRes.data.departments || []);
        if (officerRes.data.success) setOfficers(officerRes.data.officers || []);
      } catch (err) {
        console.error('[AdminComplaints] Failed to load meta:', err.message);
      }
    };
    fetchMeta();
  }, []);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (overdueOnly) params.append('overdueOnly', 'true');
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await api.get(`/complaints?${params.toString()}`);
      if (res.data.success) {
        setComplaints(res.data.complaints || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.totalCount || 0);
      }
    } catch (err) {
      console.error('[AdminComplaints] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, departmentFilter, priorityFilter, overdueOnly, searchTerm]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleOpenAssignModal = (complaint) => {
    setSelectedComplaint(complaint);
    setAssignDept(complaint.department?._id || '');
    setAssignOfficer(complaint.assignedOfficer?._id || '');
    setAssignPriority(complaint.priority || 'Medium');
    setAssignNotes('');
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setSavingAssignment(true);
    try {
      const res = await api.put(`/complaints/${selectedComplaint._id}/assign`, {
        departmentId: assignDept || undefined,
        officerId: assignOfficer || undefined,
        priority: assignPriority,
        notes: assignNotes.trim(),
      });

      if (res.data.success) {
        setSelectedComplaint(null);
        fetchComplaints();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Assignment failed');
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-950">
          Master Grievance Management
        </h1>
        <p className="text-xs text-slate-500">
          System-wide grievance registry ({totalCount} total cases)
        </p>
      </div>

      {/* Filters and Search Bar */}
      <div className="civic-card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            fetchComplaints();
          }}
          className="relative flex-1"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by reference ID, citizen, or keywords..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none"
          >
            <option value="all">Status: All</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
            <option value="Reopened">Reopened</option>
          </select>

          {/* Department filter */}
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none"
          >
            <option value="all">Department: All</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Overdue toggle */}
          <button
            type="button"
            onClick={() => {
              setOverdueOnly(!overdueOnly);
              setPage(1);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              overdueOnly
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue Only</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="civic-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">{t('loading')}</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No grievances matched your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 font-semibold">Reference</th>
                  <th className="py-3 px-3 font-semibold">Title</th>
                  <th className="py-3 px-3 font-semibold">Department</th>
                  <th className="py-3 px-3 font-semibold">Assigned Officer</th>
                  <th className="py-3 px-3 font-semibold">Priority</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">SLA Status</th>
                  <th className="py-3 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-navy-900">
                      {c.trackingId}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 max-w-[200px] truncate">
                      {c.title}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {c.department?.name || <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {c.assignedOfficer?.name || <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="py-3 px-3">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 px-3">
                      <SlaBadge slaInfo={c.slaInfo} deadline={c.slaDeadline} status={c.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(c)}
                          className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] border border-teal-200 transition-colors"
                        >
                          Assign
                        </button>
                        <Link
                          to={`/complaints/${c._id}`}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              {t('showingPage')} {page} {t('of')} {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  <span>Assign Grievance {selectedComplaint.trackingId}</span>
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{selectedComplaint.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <select
                  value={assignDept}
                  onChange={(e) => setAssignDept(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Investigating Officer
                </label>
                <select
                  value={assignOfficer}
                  onChange={(e) => setAssignOfficer(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                >
                  <option value="">Select Officer (Optional)</option>
                  {officers.map((off) => (
                    <option key={off._id} value={off._id}>
                      {off.name} ({off.department?.name || 'Officer'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Priority Override
                </label>
                <select
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                >
                  <option value="Low">Low (120 hrs SLA)</option>
                  <option value="Medium">Medium (72 hrs SLA)</option>
                  <option value="High">High (48 hrs SLA)</option>
                  <option value="Urgent">Urgent (24 hrs SLA)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignment Directives / Instructions
                </label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Dispatched to South Zone pipeline team for urgent inspection..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingAssignment ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminComplaints;
