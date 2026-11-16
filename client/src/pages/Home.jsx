import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Shield,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Droplet,
  Zap,
  Hammer,
  Trash2,
  HeartPulse,
  GraduationCap,
  ShieldAlert,
  Bus,
  Sparkles,
  TrendingUp,
  UserCheck,
  Building2,
  LogIn,
  FileText,
  BarChart3,
  AlertTriangle,
  Users,
  Settings,
  PlusCircle,
  FolderKanban,
  CheckSquare,
  Loader2,
} from 'lucide-react';

const Home = () => {
  const { t } = useLanguage();
  const { user, isAuthenticated, isCitizen, isOfficer, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [trackId, setTrackId] = useState('');
  const [publicStats, setPublicStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const [officerStats, setOfficerStats] = useState(null);
  const [officerLoading, setOfficerLoading] = useState(false);
  const [officerError, setOfficerError] = useState(false);

  useEffect(() => {
    const isValidPublicStats = (payload) =>
      Boolean(
        payload?.success &&
          payload?.stats &&
          typeof payload.stats === 'object' &&
          typeof payload.stats.totalComplaints === 'number'
      );

    const fetchPublicMetrics = async () => {
      setStatsLoading(true);
      setStatsError(false);
      try {
        const res = await api.get('/analytics/public');
        if (isValidPublicStats(res.data)) {
          setPublicStats(res.data.stats);
          return;
        }
        throw new Error('Unexpected response from public analytics endpoint');
      } catch (primaryErr) {
        // Fallback to same-origin Vite proxy if cross-origin baseURL is blocked or unreachable
        if (api.defaults.baseURL && api.defaults.baseURL !== '/api/v1') {
          try {
            const proxyRes = await axios.get('/api/v1/analytics/public');
            if (isValidPublicStats(proxyRes.data)) {
              setPublicStats(proxyRes.data.stats);
              return;
            }
          } catch (proxyErr) {
            console.warn(
              '[Home] Fallback /api/v1/analytics/public failed:',
              proxyErr?.response?.status || proxyErr?.message
            );
          }
        }
        console.warn(
          '[Home] Failed to load public metrics:',
          primaryErr?.response?.status || primaryErr?.message
        );
        setPublicStats(null);
        setStatsError(true);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchPublicMetrics();
  }, []);

  // Fetch officer personal & department workload stats if authenticated as officer
  useEffect(() => {
    if (isAuthenticated && isOfficer) {
      const fetchOfficerMetrics = async () => {
        setOfficerLoading(true);
        setOfficerError(false);
        try {
          const res = await api.get('/analytics/officer');
          if (res.data?.success && res.data?.stats) {
            setOfficerStats(res.data.stats);
          } else {
            setOfficerStats(null);
            setOfficerError(true);
          }
        } catch (err) {
          console.warn('[Home] Failed to load officer metrics:', err.message);
          setOfficerStats(null);
          setOfficerError(true);
        } finally {
          setOfficerLoading(false);
        }
      };
      fetchOfficerMetrics();
    } else {
      setOfficerStats(null);
      setOfficerLoading(false);
      setOfficerError(false);
    }
  }, [isAuthenticated, isOfficer]);

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    const clean = trackId.trim().toUpperCase();
    if (clean) {
      if (isOfficer) {
        navigate(`/officer/complaints/${clean}`);
      } else {
        navigate(`/complaints/${clean}`);
      }
    }
  };

  const categories = [
    { name: t('catWater'), icon: Droplet, color: 'text-blue-600 bg-blue-50' },
    { name: t('catElectricity'), icon: Zap, color: 'text-amber-600 bg-amber-50' },
    { name: t('catRoads'), icon: Hammer, color: 'text-orange-600 bg-orange-50' },
    { name: t('catSanitation'), icon: Trash2, color: 'text-emerald-600 bg-emerald-50' },
    { name: t('catHealth'), icon: HeartPulse, color: 'text-rose-600 bg-rose-50' },
    { name: t('catEducation'), icon: GraduationCap, color: 'text-indigo-600 bg-indigo-50' },
    { name: t('catSafety'), icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
    { name: t('catTransport'), icon: Bus, color: 'text-cyan-600 bg-cyan-50' },
  ];

  // Helper for category target link based on role
  const getCategoryLink = (catName) => {
    if (!isAuthenticated) return '/login';
    if (isCitizen) return `/complaints/submit?category=${encodeURIComponent(catName)}`;
    if (isOfficer) return `/officer/complaints?category=${encodeURIComponent(catName)}`;
    if (isAdmin) return `/admin/complaints?category=${encodeURIComponent(catName)}`;
    return '/departments';
  };

  const getCategoryActionLabel = () => {
    if (!isAuthenticated) return t('heroSignInToReportHover');
    if (isCitizen) return 'File report →';
    if (isOfficer) return t('heroViewAssignedCasesHover');
    if (isAdmin) return t('heroFilterGrievancesHover');
    return 'View department →';
  };

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-slate-900 text-white pt-16 pb-24 sm:pt-24 sm:pb-32">
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Role-Specific Badge */}
          {isAuthenticated && isOfficer && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-semibold backdrop-blur-sm">
              <Building2 className="w-4 h-4 text-indigo-300" />
              <span>{t('heroBadgeOfficer')}</span>
              {user?.department?.name && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-white font-medium">{user.department.name}</span>
                </>
              )}
            </div>
          )}

          {isAuthenticated && isAdmin && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold backdrop-blur-sm">
              <Shield className="w-4 h-4 text-amber-300" />
              <span>{t('heroBadgeAdmin')}</span>
            </div>
          )}

          {isAuthenticated && isCitizen && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold backdrop-blur-sm">
              <UserCheck className="w-4 h-4 text-teal-300" />
              <span>{t('heroBadgeCitizen')}</span>
            </div>
          )}

          {!isAuthenticated && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>{t('heroBadgePublic')}</span>
            </div>
          )}

          {/* Role-Specific Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white max-w-4xl mx-auto">
            {isAuthenticated && isOfficer
              ? t('officerHeroTitle')
              : isAuthenticated && isAdmin
              ? t('adminHeroTitle')
              : t('heroTitle')}
          </h1>

          {/* Role-Specific Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {isAuthenticated && isOfficer
              ? user?.name
                ? `${user.name} — ${t('officerHeroSubtitle')}`
                : t('officerHeroSubtitle')
              : isAuthenticated && isAdmin
              ? user?.name
                ? `${user.name} — ${t('adminHeroSubtitle')}`
                : t('adminHeroSubtitle')
              : t('heroSubtitle')}
          </p>

          {/* Action CTAs & Search Bar */}
          <div className="pt-4 max-w-2xl mx-auto space-y-6">
            {/* OFFICER CTAs */}
            {isAuthenticated && isOfficer && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/officer/complaints"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t('heroViewAssigned')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/officer/dashboard"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-indigo-400/40 hover:bg-indigo-950/40 text-indigo-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>{t('heroOfficerDashboard')}</span>
                </Link>
              </div>
            )}

            {/* ADMIN CTAs */}
            {isAuthenticated && isAdmin && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/admin/dashboard"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold text-sm shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>{t('heroAdminDashboard')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/admin/complaints"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-amber-400/40 hover:bg-amber-950/40 text-amber-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  <span>{t('heroManageComplaints')}</span>
                </Link>
              </div>
            )}

            {/* CITIZEN CTAs */}
            {isAuthenticated && isCitizen && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/complaints/submit"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold text-sm shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('heroSubmitBtn')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/complaints/my"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-slate-600 hover:border-slate-400 hover:bg-slate-800/40 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t('navMyComplaints')}</span>
                </Link>
                <Link
                  to="/dashboard"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-teal-300 font-semibold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <span>{t('heroCitizenDashboard')}</span>
                </Link>
              </div>
            )}

            {/* UNAUTHENTICATED CTAs */}
            {!isAuthenticated && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold text-sm shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <span>{t('heroSubmitBtn')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-slate-600 hover:border-slate-400 hover:bg-slate-800/40 text-slate-200 font-semibold text-sm transition-all"
                >
                  {t('navHowItWorks')}
                </Link>
              </div>
            )}

            {/* Quick Tracking Search Form */}
            <form
              onSubmit={handleTrackSubmit}
              className="relative flex items-center max-w-md mx-auto bg-white/10 backdrop-blur-md rounded-xl p-1.5 border border-white/20 shadow-xl"
            >
              <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                placeholder={t('heroTrackPlaceholder')}
                className="w-full bg-transparent border-none text-white placeholder-slate-400 text-xs sm:text-sm px-3 py-2 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-teal-300 font-semibold text-xs transition-colors shrink-0"
              >
                {t('heroTrackSubmit')}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Role-Aware Metrics & Workload Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 relative z-10">
        {isAuthenticated && isOfficer ? (
          /* OFFICER WORKLOAD BANNER */
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-indigo-700 tracking-wider uppercase">
                  Officer Active Queue
                </span>
                <h3 className="text-lg font-bold text-navy-950">
                  {user?.name}’s Caseload & SLA Monitor
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/officer/complaints"
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t('heroViewAssigned')}</span>
                </Link>
                <Link
                  to="/officer/dashboard"
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                >
                  {t('heroOfficerDashboard')}
                </Link>
              </div>
            </div>

            {officerLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>{t('loading')}</span>
              </div>
            ) : officerError || !officerStats ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Officer workload metrics are currently unavailable. Please inspect your queue directly.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                <Link
                  to="/officer/assigned"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block"
                >
                  <p className="text-2xl sm:text-4xl font-extrabold text-navy-900 font-mono">
                    {officerStats.total}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    Assigned to Me
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Dept Pool: {officerStats.unassignedDepartment?.total ?? 0} unassigned
                  </span>
                </Link>
                <Link
                  to="/officer/assigned?status=pending"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block border-l border-slate-100"
                >
                  <p className="text-2xl sm:text-4xl font-extrabold text-amber-600 font-mono">
                    {officerStats.pending}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {t('heroPendingCases')}
                  </p>
                </Link>
                <Link
                  to="/officer/assigned?overdueOnly=true"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block border-l border-slate-100"
                >
                  <p
                    className={`text-2xl sm:text-4xl font-extrabold font-mono ${
                      officerStats.overdue > 0 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'
                    }`}
                  >
                    {officerStats.overdue}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {t('heroOverdueCases')}
                  </p>
                </Link>
                <Link
                  to="/officer/assigned"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block border-l border-slate-100"
                >
                  <div className="flex justify-center mb-1 text-indigo-600">
                    <CheckSquare className="w-8 h-8" />
                  </div>
                  <p className="text-xs sm:text-sm text-indigo-700 font-bold mt-1">
                    {t('heroResolveComplaintsAction')}
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Click to inspect</span>
                </Link>
              </div>
            )}
          </div>
        ) : isAuthenticated && isAdmin ? (
          /* ADMIN CONSOLE BANNER */
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-amber-700 tracking-wider uppercase">
                  System Command Console
                </span>
                <h3 className="text-lg font-bold text-navy-950">
                  Municipal Redressal Overview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/dashboard"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{t('heroAdminDashboard')}</span>
                </Link>
                <Link
                  to="/admin/complaints"
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                >
                  {t('heroManageComplaints')}
                </Link>
              </div>
            </div>

            {statsLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span>{t('loading')}</span>
              </div>
            ) : statsError || !publicStats ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Live system overview metrics are temporarily unavailable. Open the Admin Dashboard to retry.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                <Link
                  to="/admin/complaints"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block"
                >
                  <p className="text-2xl sm:text-4xl font-extrabold text-navy-900 font-mono">
                    {Number(publicStats.totalComplaints ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    All Grievances
                  </p>
                </Link>
                <Link
                  to="/admin/complaints?status=Resolved"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block border-l border-slate-100"
                >
                  <p className="text-2xl sm:text-4xl font-extrabold text-teal-600 font-mono">
                    {Number(publicStats.resolvedComplaints ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {t('statsResolved')}
                  </p>
                </Link>
                <Link
                  to="/admin/departments"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block border-l border-slate-100"
                >
                  <p className="text-2xl sm:text-4xl font-extrabold text-indigo-600 font-mono">
                    {Number(publicStats.activeDepartments ?? 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {t('statsDepartments')}
                  </p>
                </Link>
                <Link
                  to="/admin/users"
                  className="text-center p-3 rounded-xl hover:bg-slate-50 transition-colors block border-l border-slate-100"
                >
                  <div className="flex justify-center mb-1 text-amber-600">
                    <Users className="w-8 h-8" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 font-bold mt-1">
                    User Management
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Manage personnel</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* CITIZEN & PUBLIC METRICS BANNER */
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
            {statsLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>{t('loading')}</span>
              </div>
            ) : statsError || !publicStats ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Live portal metrics are temporarily unavailable. Please try again later.</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  <div className="text-center p-2">
                    <p className="text-2xl sm:text-4xl font-extrabold text-navy-900 font-mono">
                      {Number(publicStats.totalComplaints ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                      {t('statsTotalComplaints')}
                    </p>
                  </div>
                  <div className="text-center p-2 border-l border-slate-100">
                    <p className="text-2xl sm:text-4xl font-extrabold text-teal-600 font-mono">
                      {Number(publicStats.resolvedComplaints ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                      {t('statsResolved')}
                    </p>
                  </div>
                  <div className="text-center p-2 border-l border-slate-100">
                    <p className="text-2xl sm:text-4xl font-extrabold text-emerald-600 font-mono">
                      {Number(publicStats.resolutionRate ?? 0)}%
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                      {t('statsResolutionRate')}
                    </p>
                  </div>
                  <div className="text-center p-2 border-l border-slate-100">
                    <p className="text-2xl sm:text-4xl font-extrabold text-indigo-600 font-mono">
                      {Number(publicStats.activeDepartments ?? 0)}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                      {t('statsDepartments')}
                    </p>
                  </div>
                </div>
                {publicStats.totalComplaints === 0 && (
                  <p className="text-center text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                    No civic grievances have been submitted yet. Live statistics will update automatically once complaints are filed.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Role-Based Civic Redressal Portals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold text-teal-700 tracking-wider uppercase">
            Official Access Channels
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-navy-950 mt-1">
            Civic Redressal & Governance Portals
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2">
            Secure, role-tailored digital portals designed for citizens, department investigation officers, and executive municipal administration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Citizen Portal Card */}
          <div
            className={`civic-card p-6 flex flex-col justify-between border-t-4 border-t-teal-500 hover:shadow-lg transition-all ${
              isAuthenticated && isCitizen ? 'ring-2 ring-teal-500 shadow-md bg-teal-50/20' : ''
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <UserCheck className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                  {isAuthenticated && isCitizen ? t('activePortalBadge') : 'Public Service'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-950">Citizen Portal</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  File civic grievances with location and image evidence, receive real-time resolution updates, review officer resolution evidence, and submit satisfaction feedback.
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Unique tracking ID & SLA countdown</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Interactive timeline & progress comments</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Resolution acceptance & reopening rights</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              {isAuthenticated && isCitizen ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    to="/complaints/submit"
                    className="flex-1 py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs text-center shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{t('heroSubmitBtn')}</span>
                  </Link>
                  <Link
                    to="/complaints/my"
                    className="py-2 px-3 rounded-lg border border-teal-300 text-teal-800 hover:bg-teal-50 font-semibold text-xs text-center transition-colors"
                  >
                    {t('navMyComplaints')}
                  </Link>
                </div>
              ) : isAuthenticated && isOfficer ? (
                <div className="text-center py-2 px-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Logged in as Department Officer. Grievance filing is restricted to citizen accounts.
                  </p>
                </div>
              ) : isAuthenticated && isAdmin ? (
                <div className="text-center py-2 px-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Logged in as Administrator. Grievance filing is restricted to citizen accounts.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    to="/login/citizen"
                    className="flex-1 py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs text-center shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Citizen Login</span>
                  </Link>
                  <Link
                    to="/register"
                    className="py-2 px-3 rounded-lg border border-teal-300 text-teal-800 hover:bg-teal-50 font-semibold text-xs text-center transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Department Officer Portal Card */}
          <div
            className={`civic-card p-6 flex flex-col justify-between border-t-4 border-t-indigo-600 hover:shadow-lg transition-all ${
              isAuthenticated && isOfficer ? 'ring-2 ring-indigo-500 shadow-md bg-indigo-50/20' : ''
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {isAuthenticated && isOfficer ? t('activePortalBadge') : 'Nodal Officers'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-950">Department Officer Portal</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Dedicated interface for designated departmental officers to inspect assigned cases, manage field investigations, record internal notes, and submit resolution proofs.
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Department & assigned workload queue</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>SLA countdown with 24h breach warning</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Resolution evidence photo verification</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              {isAuthenticated && isOfficer ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    to="/officer/complaints"
                    className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs text-center shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t('heroViewAssigned')}</span>
                  </Link>
                  <Link
                    to="/officer/dashboard"
                    className="py-2 px-3 rounded-lg border border-indigo-300 text-indigo-800 hover:bg-indigo-50 font-semibold text-xs text-center transition-colors"
                  >
                    {t('heroOfficerDashboard')}
                  </Link>
                </div>
              ) : isAuthenticated ? (
                <div className="text-center py-2 px-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Department Officer console. Restricted to authorized municipal personnel.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login/officer"
                    className="w-full py-2.5 px-3 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs text-center shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Officer Login</span>
                  </Link>
                  <p className="text-[10px] text-slate-400 text-center">
                    Accounts are provisioned by administrative command.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Administrator Command Console Card */}
          <div
            className={`civic-card p-6 flex flex-col justify-between border-t-4 border-t-amber-500 hover:shadow-lg transition-all ${
              isAuthenticated && isAdmin ? 'ring-2 ring-amber-500 shadow-md bg-amber-50/20' : ''
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                  {isAuthenticated && isAdmin ? t('activePortalBadge') : 'Command Console'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-950">Administrator Command</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Executive governance console to provision officer accounts, configure department SLA benchmarks, inspect tamper-evident audit logs, and oversee resolution metrics.
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Full system-wide grievance management</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Officer onboarding & department mapping</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Tamper-evident audit trail & analytics</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              {isAuthenticated && isAdmin ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    to="/admin/dashboard"
                    className="flex-1 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs text-center shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>{t('heroAdminDashboard')}</span>
                  </Link>
                  <Link
                    to="/admin/complaints"
                    className="py-2 px-3 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold text-xs text-center transition-colors"
                  >
                    {t('heroManageComplaints')}
                  </Link>
                </div>
              ) : isAuthenticated ? (
                <div className="text-center py-2 px-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Restricted to authorized municipal administrators.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login/admin"
                    className="w-full py-2.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs text-center shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Administrator Login</span>
                  </Link>
                  <p className="text-[10px] text-slate-400 text-center">
                    Access is restricted to authorized government executives.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works 4-Step Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold text-teal-700 tracking-wider uppercase">
            Transparent Redressal Architecture
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-navy-950 mt-2">
            {t('howTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="civic-card p-6 relative">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900">{t('howStep1Title')}</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{t('howStep1Desc')}</p>
          </div>

          <div className="civic-card p-6 relative">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900">{t('howStep2Title')}</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{t('howStep2Desc')}</p>
          </div>

          <div className="civic-card p-6 relative">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900">{t('howStep3Title')}</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{t('howStep3Desc')}</p>
          </div>

          <div className="civic-card p-6 relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold mb-4">
              4
            </div>
            <h3 className="text-base font-bold text-slate-900">{t('howStep4Title')}</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{t('howStep4Desc')}</p>
          </div>
        </div>
      </section>

      {/* Civic Sectors Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold text-teal-700 tracking-wider uppercase">
              Covered Public Services
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mt-1">
              {t('categoriesTitle')}
            </h2>
          </div>
          <Link
            to="/departments"
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
          >
            <span>View Department Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            const targetUrl = getCategoryLink(cat.name);
            const actionLabel = getCategoryActionLabel();

            return (
              <Link
                key={idx}
                to={targetUrl}
                className="civic-card p-5 group hover:border-teal-400 hover:shadow-md transition-all flex flex-col items-center text-center"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${cat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-teal-700">
                  {cat.name}
                </h3>
                <span className="text-[11px] text-teal-600 font-medium mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {actionLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bottom Authority & Accountability Callout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-navy-900 to-navy-950 rounded-2xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="max-w-3xl space-y-4 relative z-10">
            {isAuthenticated && isOfficer ? (
              /* OFFICER CALLOUT */
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Nodal Department Authority</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                  {t('officerCalloutTitle')}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {t('officerCalloutDesc')}
                </p>
                <div className="pt-4 flex flex-wrap gap-4">
                  <Link
                    to="/officer/complaints"
                    className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{t('heroViewAssigned')}</span>
                  </Link>
                  <Link
                    to="/officer/dashboard"
                    className="px-6 py-3 rounded-xl border border-indigo-400/50 hover:bg-navy-800 text-indigo-200 font-semibold text-xs sm:text-sm transition-all"
                  >
                    {t('heroOfficerDashboard')}
                  </Link>
                </div>
              </>
            ) : isAuthenticated && isAdmin ? (
              /* ADMIN CALLOUT */
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/20 text-amber-300 text-xs font-semibold">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Municipal Executive Administration</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                  {t('adminCalloutTitle')}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {t('adminCalloutDesc')}
                </p>
                <div className="pt-4 flex flex-wrap gap-4">
                  <Link
                    to="/admin/dashboard"
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>{t('heroAdminDashboard')}</span>
                  </Link>
                  <Link
                    to="/admin/complaints"
                    className="px-6 py-3 rounded-xl border border-amber-400/50 hover:bg-navy-800 text-amber-200 font-semibold text-xs sm:text-sm transition-all"
                  >
                    {t('heroManageComplaints')}
                  </Link>
                </div>
              </>
            ) : isAuthenticated && isCitizen ? (
              /* CITIZEN CALLOUT */
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-teal-500/20 text-teal-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Right to Service Guarantee</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                  Every Grievance Backed by Legal SLAs & AI Verification
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Nagrik Sahayak eliminates arbitrary delays and unanswered phone calls. Each ticket is given a countdown deadline. If unaddressed, it triggers escalation flags directly on senior administrative dashboards.
                </p>
                <div className="pt-4 flex flex-wrap gap-4">
                  <Link
                    to="/complaints/submit"
                    className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{t('heroSubmitBtn')}</span>
                  </Link>
                  <Link
                    to="/complaints/my"
                    className="px-6 py-3 rounded-xl border border-slate-700 hover:bg-navy-800 text-slate-200 font-semibold text-xs sm:text-sm transition-all"
                  >
                    {t('navMyComplaints')}
                  </Link>
                </div>
              </>
            ) : (
              /* PUBLIC CALLOUT */
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-teal-500/20 text-teal-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Right to Service Guarantee</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                  Every Grievance Backed by Legal SLAs & AI Verification
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Nagrik Sahayak eliminates arbitrary delays and unanswered phone calls. Each ticket is given a countdown deadline. If unaddressed, it triggers escalation flags directly on senior administrative dashboards.
                </p>
                <div className="pt-4 flex flex-wrap gap-4">
                  <Link
                    to="/register"
                    className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold text-xs sm:text-sm shadow-md transition-all"
                  >
                    Register as Citizen
                  </Link>
                  <Link
                    to="/departments"
                    className="px-6 py-3 rounded-xl border border-slate-700 hover:bg-navy-800 text-slate-200 font-semibold text-xs sm:text-sm transition-all"
                  >
                    Explore Departments
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
