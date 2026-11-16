import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { FileText, Shield, Activity, Calendar, User, Loader2 } from 'lucide-react';

const AdminReports = () => {
  const { t } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await api.get('/analytics/admin');
        if (res.data.success) {
          setLogs(res.data.recentAuditLogs || []);
          setStats(res.data.stats);
        }
      } catch (err) {
        console.error('[AdminReports] Error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">
          Compliance & Audit Trail Reports
        </h1>
        <p className="text-xs text-slate-500">
          Tamper-evident logs of administrative actions, status transitions, and user management events
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">{t('loading')}</p>
        </div>
      ) : (
        <div className="civic-card overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Verifiable Activity Stream</span>
            </span>
            <span className="text-xs text-slate-500">
              Total system grievances: {stats?.totalComplaints || 0}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50/70 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold font-sans">Timestamp</th>
                  <th className="py-3 px-4 font-semibold font-sans">Actor</th>
                  <th className="py-3 px-4 font-semibold font-sans">Role</th>
                  <th className="py-3 px-4 font-semibold font-sans">Action Verb</th>
                  <th className="py-3 px-4 font-semibold font-sans">Target Entity</th>
                  <th className="py-3 px-4 font-semibold font-sans">IP / Client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No audit records logged yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">
                        {log.actorName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {log.actorRole}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-teal-800">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-sans">
                        <span className="font-semibold">{log.targetType}</span>{' '}
                        {log.targetId && (
                          <span className="text-slate-400 font-mono text-[11px]">
                            ({log.targetId.substring(0, 10)}...)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReports;
