import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { Building2, Clock, CheckCircle2, Search, Loader2, Phone, Mail } from 'lucide-react';

const Departments = () => {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/departments');
      if (res.data.success) {
        setDepartments(res.data.departments || []);
      }
    } catch (err) {
      console.error('[Departments] Failed to load:', err.message);
      setError(err.response?.data?.message || err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const term = (searchTerm || '').trim().toLowerCase();
  const filteredDepts = departments.filter((d) => {
    if (!term) return true;
    return (
      d.name?.toLowerCase().includes(term) ||
      d.code?.toLowerCase().includes(term) ||
      d.description?.toLowerCase().includes(term) ||
      d.categories?.some((c) => c?.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-teal-700 tracking-wider uppercase">
            Civic Directory
          </span>
          <h1 className="text-3xl font-extrabold text-navy-950 mt-1">
            {t('navDepartments')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Official public service departments, jurisdiction sectors, and statutory resolution timeframes.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            id="department-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search departments or categories..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500">{t('loading')}</p>
        </div>
      ) : error ? (
        <div className="civic-card p-12 text-center text-rose-600 text-sm space-y-3">
          <p>{error}</p>
          <button
            onClick={fetchDepartments}
            className="px-4 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : filteredDepts.length === 0 ? (
        <div className="civic-card p-12 text-center text-slate-500 text-sm">
          {departments.length === 0
            ? 'No departments currently registered in the system.'
            : `No departments matched your search "${searchTerm.trim()}".`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepts.map((dept) => (
            <div key={dept._id} className="civic-card p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-700">
                    {dept.code}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                    {dept.description || 'Public grievance redressal wing.'}
                  </p>
                </div>

                {/* Categories */}
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Covered Categories:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {dept.categories?.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-teal-50 text-teal-800 border border-teal-200/60 font-medium"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* SLA Target Hours & Status */}
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>SLA Targets:</span>
                  </span>
                  <span className="font-medium text-slate-800">
                    Urgent: {dept.slaHours?.Urgent || 24}h | High: {dept.slaHours?.High || 48}h
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Grievances Handled:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {dept.totalComplaints || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Active Pending:</span>
                  <span className="font-bold text-amber-700 font-mono">
                    {dept.pendingComplaints || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Departments;
