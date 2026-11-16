import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import SlaBadge from '../components/SlaBadge';
import {
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';

const AssignedComplaints = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get('overdueOnly') === 'true');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const s = searchParams.get('status');
    const o = searchParams.get('overdueOnly');
    setStatusFilter(s || 'all');
    setOverdueOnly(o === 'true');
    setPage(1);
  }, [searchParams]);

  const fetchAssigned = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (overdueOnly) params.append('overdueOnly', 'true');
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await api.get(`/complaints/assigned?${params.toString()}`);
      if (res.data.success) {
        setComplaints(res.data.complaints || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.totalCount || 0);
      } else {
        setError('Unable to load assigned grievances.');
      }
    } catch (err) {
      console.error('[AssignedComplaints] Error:', err.message);
      setError(err.response?.data?.message || 'Unable to load assigned grievances right now.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, overdueOnly, searchTerm]);

  useEffect(() => {
    fetchAssigned();
  }, [fetchAssigned]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAssigned();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-950">
          {t('navAssignedComplaints')}
        </h1>
        <p className="text-xs text-slate-500">
          Departmental grievance queue ({totalCount} total cases assigned)
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="civic-card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by reference, citizen, title..."
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
            <option value="pending">Status: Pending (All Active)</option>
            <option value="Submitted">Submitted</option>
            <option value="Received">Received</option>
            <option value="Under Review">Under Review</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
            <option value="Rejected">Rejected</option>
            <option value="Reopened">Reopened</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none"
          >
            <option value="all">Priority: All</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
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
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Overdue Only</span>
          </button>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="civic-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">{t('loading')}</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-700 text-xs flex flex-col items-center gap-2 bg-rose-50/50">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            <span>{error}</span>
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
                  <th className="py-3.5 px-4 font-semibold">Reference</th>
                  <th className="py-3.5 px-4 font-semibold">Title</th>
                  <th className="py-3.5 px-4 font-semibold">Citizen Info</th>
                  <th className="py-3.5 px-4 font-semibold">Priority</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">SLA Target</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-navy-900">
                      {c.trackingId}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[240px] truncate">
                      {c.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-semibold text-slate-800">{c.citizen?.name}</div>
                      <div className="text-[10px] text-slate-400">{c.citizen?.phone || c.citizen?.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <SlaBadge slaInfo={c.slaInfo} deadline={c.slaDeadline} status={c.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/officer/complaints/${c._id}`}
                        className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] transition-colors"
                      >
                        Action
                      </Link>
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
    </div>
  );
};

export default AssignedComplaints;
