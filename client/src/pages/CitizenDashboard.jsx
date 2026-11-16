import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import SlaBadge from '../components/SlaBadge';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  ArrowRight,
  Loader2,
  Calendar,
} from 'lucide-react';

const CitizenDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCitizenData = async () => {
      setError(false);
      try {
        const res = await api.get('/analytics/citizen');
        if (res.data?.success && res.data?.stats) {
          setStats(res.data.stats);
          setRecentComplaints(res.data.recentComplaints || []);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('[CitizenDashboard] Error loading data:', err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchCitizenData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500">{t('loading')}</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="civic-card p-6 bg-rose-50 border-rose-200 text-rose-800 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Unable to load your dashboard metrics right now. Please refresh or view your grievances directly.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase">
            {t('citizenWelcome')}
          </span>
          <h1 className="text-2xl font-extrabold text-navy-950 mt-1">
            Namaste, {user?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('citizenSubtitle')}
          </p>
        </div>

        <Link
          to="/complaints/submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t('btnNewGrievance')}</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={t('statTotalFiled')}
          value={stats?.total || 0}
          icon={FileText}
          color="navy"
          subtitle="Registered in system"
          onClick={() => navigate('/complaints/my')}
        />
        <StatCard
          title={t('statPending')}
          value={stats?.pending || 0}
          icon={Clock}
          color="blue"
          subtitle="Active redressal underway"
          onClick={() => navigate('/complaints/my')}
        />
        <StatCard
          title={t('statResolvedComplaints')}
          value={stats?.resolved || 0}
          icon={CheckCircle2}
          color="emerald"
          subtitle={`${stats?.resolutionRate || 0}% resolution rate`}
          onClick={() => navigate('/complaints/my')}
        />
        <StatCard
          title={t('statOverdue')}
          value={stats?.overdue || 0}
          icon={AlertTriangle}
          color="rose"
          subtitle="Breached statutory SLA"
          onClick={() => navigate('/complaints/my')}
        />
      </div>

      {/* Recent Complaints Section */}
      <div className="civic-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy-900">
            {t('recentGrievancesTitle')}
          </h2>
          <Link
            to="/complaints/my"
            className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>{t('viewAllGrievances')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentComplaints.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-xs text-slate-500">{t('noGrievancesYet')}</p>
            <Link
              to="/complaints/submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-50 text-teal-800 font-semibold text-xs border border-teal-200 hover:bg-teal-100 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Submit your first grievance</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 font-semibold">Reference ID</th>
                  <th className="py-3 px-3 font-semibold">Title</th>
                  <th className="py-3 px-3 font-semibold">Category</th>
                  <th className="py-3 px-3 font-semibold">Priority</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">SLA Deadline</th>
                  <th className="py-3 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentComplaints.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-navy-800">
                      {c.trackingId}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 max-w-[200px] truncate">
                      {c.title}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{c.category}</td>
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
                      <Link
                        to={`/complaints/${c._id}`}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenDashboard;
