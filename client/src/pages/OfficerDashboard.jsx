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
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

const OfficerDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [urgentComplaints, setUrgentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchOfficerMetrics = async () => {
      setError(false);
      try {
        const res = await api.get('/analytics/officer');
        if (res.data?.success && res.data?.stats) {
          setStats(res.data.stats);
          setUrgentComplaints(res.data.urgentComplaints || []);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('[OfficerDashboard] Failed to fetch:', err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchOfficerMetrics();
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
          <span>Unable to load officer workload analytics right now. Please refresh or inspect your assigned queue.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase">
            {t('officerWelcome')}
          </span>
          <h1 className="text-2xl font-extrabold text-navy-950 mt-1">
            Officer {user?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('officerSubtitle')} • Assigned Department: {user?.department?.name || 'General Municipal'}
          </p>
        </div>

        <Link
          to="/officer/assigned"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <span>View All Assigned</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Personal Workload Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={t('statAssignedTotal')}
          value={stats?.total || 0}
          icon={FileText}
          color="navy"
          subtitle={`Assigned to me (${stats?.pending || 0} pending)`}
          onClick={() => navigate('/officer/assigned')}
        />
        <StatCard
          title={t('statUrgentQueue')}
          value={stats?.urgent || 0}
          icon={ShieldAlert}
          color="rose"
          subtitle="Critical active personal cases"
          onClick={() => navigate('/officer/assigned?status=pending')}
        />
        <StatCard
          title={t('statApproachingSLA')}
          value={stats?.approachingDeadline || 0}
          icon={Clock}
          color="amber"
          subtitle="Deadline within 24 hours"
          onClick={() => navigate('/officer/assigned?status=pending')}
        />
        <StatCard
          title="SLA Breached"
          value={stats?.overdue || 0}
          icon={AlertTriangle}
          color="rose"
          subtitle="Active personal overdue cases"
          onClick={() => navigate('/officer/assigned?overdueOnly=true')}
        />
      </div>

      {/* Separated Personal vs Department Pool Workload Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="civic-card p-4 border-l-4 border-l-teal-600">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
            Assigned to Me (Personal)
          </p>
          <p className="text-2xl font-extrabold text-navy-950 font-mono mt-1">
            {stats?.assignedToMe?.total ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats?.assignedToMe?.pending ?? 0} pending • {stats?.assignedToMe?.resolved ?? 0} resolved • {stats?.assignedToMe?.overdue ?? 0} overdue
          </p>
        </div>

        <div className="civic-card p-4 border-l-4 border-l-amber-500">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Unassigned Department Pool
          </p>
          <p className="text-2xl font-extrabold text-navy-950 font-mono mt-1">
            {stats?.unassignedDepartment?.total ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats?.unassignedDepartment?.pending ?? 0} pending • {stats?.unassignedDepartment?.overdue ?? 0} overdue
          </p>
        </div>

        <div className="civic-card p-4 border-l-4 border-l-slate-400">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Assigned to Other Officers
          </p>
          <p className="text-2xl font-extrabold text-navy-950 font-mono mt-1">
            {stats?.assignedToOthers?.total ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats?.assignedToOthers?.pending ?? 0} pending • {stats?.assignedToOthers?.overdue ?? 0} overdue
          </p>
        </div>
      </div>

      {/* Urgent Cases Queue */}
      <div className="civic-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Priority Action Queue (Urgent & Approaching Deadlines)</span>
          </h2>
          <Link
            to="/officer/assigned"
            className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>View Full Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {urgentComplaints.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No urgent or overdue grievances currently pending in your queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 font-semibold">Reference</th>
                  <th className="py-3 px-3 font-semibold">Grievance Title</th>
                  <th className="py-3 px-3 font-semibold">Citizen</th>
                  <th className="py-3 px-3 font-semibold">Priority</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">SLA Status</th>
                  <th className="py-3 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {urgentComplaints.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-navy-900">
                      {c.trackingId}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 max-w-[220px] truncate">
                      {c.title}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {c.citizen?.name || 'Citizen'}
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
                      <Link
                        to={`/officer/complaints/${c._id}`}
                        className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] transition-colors"
                      >
                        Inspect & Update
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

export default OfficerDashboard;
