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
  PlusCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  AlertTriangle,
} from 'lucide-react';

const MyComplaints = () => {
  const { t } = useLanguage();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await api.get(`/complaints/my?${params.toString()}`);
      if (res.data.success) {
        setComplaints(res.data.complaints || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.totalCount || 0);
      } else {
        setError('Unable to load your grievances right now.');
      }
    } catch (err) {
      console.error('[MyComplaints] Error fetching:', err.message);
      setError(err.response?.data?.message || 'Unable to load your grievances right now.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, searchTerm]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchComplaints();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">{t('navMyComplaints')}</h1>
          <p className="text-xs text-slate-500">
            Total {totalCount} grievances registered under your account
          </p>
        </div>

        <Link
          to="/complaints/submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t('btnNewGrievance')}</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="civic-card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">{t('filterStatus')}: {t('filterAll')}</option>
            <option value="Submitted">{t('statusSubmitted')}</option>
            <option value="Received">{t('statusReceived')}</option>
            <option value="Under Review">{t('statusUnderReview')}</option>
            <option value="Assigned">{t('statusAssigned')}</option>
            <option value="In Progress">{t('statusInProgress')}</option>
            <option value="Resolved">{t('statusResolved')}</option>
            <option value="Closed">{t('statusClosed')}</option>
            <option value="Rejected">{t('statusRejected')}</option>
            <option value="Reopened">{t('statusReopened')}</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">{t('filterCategory')}: {t('filterAll')}</option>
            <option value="Water Supply">Water Supply</option>
            <option value="Electricity">Electricity</option>
            <option value="Roads and Infrastructure">Roads & Infra</option>
            <option value="Sanitation and Waste Management">Sanitation</option>
            <option value="Public Health">Public Health</option>
            <option value="Education">Education</option>
            <option value="Public Safety">Public Safety</option>
            <option value="Transport">Transport</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Complaints List Table */}
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
          <div className="p-12 text-center space-y-3">
            <FileQuestion className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No grievances found</p>
            <p className="text-xs text-slate-500">
              No records match your selected filters or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Reference</th>
                  <th className="py-3.5 px-4 font-semibold">Title</th>
                  <th className="py-3.5 px-4 font-semibold">Category</th>
                  <th className="py-3.5 px-4 font-semibold">Priority</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">SLA Countdown</th>
                  <th className="py-3.5 px-4 font-semibold">Filed Date</th>
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
                    <td className="py-3.5 px-4 text-slate-600">{c.category}</td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <SlaBadge slaInfo={c.slaInfo} deadline={c.slaDeadline} status={c.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/complaints/${c._id}`}
                        className="px-3 py-1 rounded bg-navy-50 hover:bg-navy-100 text-navy-800 font-semibold text-[11px] transition-colors"
                      >
                        View Details
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

export default MyComplaints;
