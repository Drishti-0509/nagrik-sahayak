import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import StatCard from '../components/StatCard';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Loader2,
  Activity,
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [recentAudit, setRecentAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchAdminMetrics = async () => {
      setError(false);
      try {
        const res = await api.get('/analytics/admin');
        if (res.data?.success && res.data?.stats) {
          setStats(res.data.stats);
          setCharts(res.data.charts);
          setRecentAudit(res.data.recentAuditLogs || []);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('[AdminDashboard] Error:', err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminMetrics();
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
          <span>Unable to load administrative analytics right now. Please refresh or try again later.</span>
        </div>
      </div>
    );
  }

  const total = stats?.totalComplaints || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase">
            {t('adminWelcome')}
          </span>
          <h1 className="text-2xl font-extrabold text-navy-950 mt-1">
            Executive Command Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('adminSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/complaints"
            className="px-3.5 py-2 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs transition-colors"
          >
            Manage Grievances
          </Link>
          <Link
            to="/admin/users"
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors"
          >
            Manage Officers
          </Link>
          <Link
            to="/admin/departments"
            className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
          >
            Departments & SLA
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered"
          value={stats?.totalComplaints || 0}
          icon={FileText}
          color="navy"
          subtitle="System-wide complaints"
          onClick={() => navigate('/admin/complaints')}
        />
        <StatCard
          title="Active Pending"
          value={stats?.pendingComplaints || 0}
          icon={Clock}
          color="blue"
          subtitle="Under active redressal"
          onClick={() => navigate('/admin/complaints')}
        />
        <StatCard
          title="Resolved"
          value={stats?.resolvedComplaints || 0}
          icon={CheckCircle2}
          color="emerald"
          subtitle={`${stats?.resolutionRate || 0}% resolution rate`}
          onClick={() => navigate('/admin/complaints')}
        />
        <StatCard
          title="SLA Overdue"
          value={stats?.overdueComplaints || 0}
          icon={AlertTriangle}
          color="rose"
          subtitle="Statutory deadline breaches"
          onClick={() => navigate('/admin/complaints')}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Citizens Registered"
          value={stats?.totalCitizens || 0}
          icon={Users}
          color="slate"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title="Department Officers"
          value={stats?.totalOfficers || 0}
          icon={ShieldCheck}
          color="teal"
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title="Public Departments"
          value={stats?.totalDepartments || 0}
          icon={Building2}
          color="indigo"
          onClick={() => navigate('/admin/departments')}
        />
        <StatCard
          title="Escalated Grievances"
          value={stats?.escalatedComplaints || 0}
          icon={AlertTriangle}
          color="rose"
          onClick={() => navigate('/admin/complaints')}
        />
      </div>

      {/* Analytical Breakdown Charts / Progress bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="civic-card p-6 space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center justify-between">
            <span>{t('chartsByCategory')}</span>
            <span className="text-xs text-slate-400 font-normal">Real-time DB Counts</span>
          </h2>

          <div className="space-y-3 pt-2">
            {!charts?.byCategory || charts.byCategory.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No category data recorded yet.</p>
            ) : (
              charts.byCategory.map((cat, idx) => {
                const pct = Math.round((cat.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{cat.category}</span>
                      <span className="font-mono text-slate-900 font-bold">
                        {cat.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="civic-card p-6 space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center justify-between">
            <span>{t('chartsByStatus')}</span>
            <span className="text-xs text-slate-400 font-normal">Workflow Stages</span>
          </h2>

          <div className="space-y-3 pt-2">
            {!charts?.byStatus || charts.byStatus.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No status distribution data.</p>
            ) : (
              charts.byStatus.map((st, idx) => {
                const pct = Math.round((st.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{st.status}</span>
                      <span className="font-mono text-slate-900 font-bold">
                        {st.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-navy-800 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Audit Log Feed */}
      <div className="civic-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            <span>{t('recentAuditTitle')}</span>
          </h2>
          <Link
            to="/admin/reports"
            className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>View Complete Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Actor</th>
                <th className="py-2.5 px-3 font-semibold">Role</th>
                <th className="py-2.5 px-3 font-semibold">Action Verb</th>
                <th className="py-2.5 px-3 font-semibold">Target Record</th>
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {recentAudit.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                    No recent audit activity.
                  </td>
                </tr>
              ) : (
                recentAudit.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                      {log.actorName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-700">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-teal-800">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {log.targetType} {log.targetId ? `(${log.targetId.substring(0, 8)}...)` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
