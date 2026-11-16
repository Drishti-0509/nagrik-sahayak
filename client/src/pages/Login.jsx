import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Shield,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Building2,
  ShieldAlert,
  Info,
} from 'lucide-react';

const Login = ({ initialRole }) => {
  const { login } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active portal role from props or URL path
  const determineRole = () => {
    if (initialRole) return initialRole;
    if (location.pathname.includes('/admin')) return 'admin';
    if (location.pathname.includes('/officer')) return 'officer';
    return 'citizen';
  };

  const [activeRole, setActiveRole] = useState(determineRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveRole(determineRole());
    setError('');
  }, [location.pathname, initialRole]);

  const handlePortalSwitch = (newRole) => {
    setActiveRole(newRole);
    setError('');
    setEmail('');
    setPassword('');
    if (newRole === 'admin') navigate('/login/admin');
    else if (newRole === 'officer') navigate('/login/officer');
    else navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(
        lang === 'hi'
          ? 'कृपया ईमेल और पासवर्ड दोनों दर्ज करें।'
          : 'Please provide both email and password.'
      );
      return;
    }

    setLoading(true);
    try {
      // Pass activeRole as requiredRole so the backend verifies real DB role
      const res = await login(email, password, activeRole);
      if (res.success) {
        const from = location.state?.from?.pathname;
        if (from) {
          navigate(from, { replace: true });
        } else if (res.user.role === 'citizen') {
          navigate('/dashboard', { replace: true });
        } else if (res.user.role === 'officer') {
          navigate('/officer/dashboard', { replace: true });
        } else if (res.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(res.message || 'Invalid credentials.');
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (lang === 'hi'
            ? 'साइन इन करने में विफल। कृपया क्रेडेंशियल्स की जांच करें।'
            : 'Failed to sign in. Please check your credentials.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts helper strictly for local development builds (stripped in production)
  const isDevMode = import.meta.env.DEV;
  const setDemoCredentials = (roleToFill) => {
    if (!import.meta.env.DEV) return;
    if (roleToFill === 'admin') {
      setEmail('admin@nagriksahayak.gov.in');
      setPassword('AdminSecurePassword123!');
    } else if (roleToFill === 'officer') {
      setEmail('officer.water@nagriksahayak.gov.in');
      setPassword('OfficerSecurePassword123!');
    } else {
      setEmail('citizen.demo@example.com');
      setPassword('CitizenPassword123!');
    }
  };

  const portalConfig = {
    citizen: {
      title: lang === 'hi' ? 'नागरिक पोर्टल' : 'Citizen Grievance Portal',
      subtitle:
        lang === 'hi'
          ? 'अपनी जनसमस्याएं दर्ज करें और रियल-टाइम प्रगति ट्रैक करें'
          : 'Submit public grievances and monitor transparent SLA resolution progress',
      badge: lang === 'hi' ? 'नागरिक सेवा' : 'Citizen Access',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      icon: UserCheck,
      iconBg: 'bg-teal-600 text-white',
      emailLabel: lang === 'hi' ? 'नागरिक ईमेल आईडी' : 'Citizen Email Address',
      emailPlaceholder: 'citizen@example.com',
    },
    officer: {
      title: lang === 'hi' ? 'विभागीय अधिकारी पोर्टल' : 'Department Officer Portal',
      subtitle:
        lang === 'hi'
          ? 'आवंटित विभागीय शिकायतों की जांच एवं समाधान अद्यतन'
          : 'Case investigation queue, timeline updates, & resolution evidence submission',
      badge: lang === 'hi' ? 'विभागीय अधिकारी' : 'Officer Access',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Building2,
      iconBg: 'bg-navy-900 text-teal-400',
      emailLabel:
        lang === 'hi'
          ? 'शासकीय ईमेल आईडी (@nagriksahayak.gov.in)'
          : 'Official Department Email ID',
      emailPlaceholder: 'officer.water@nagriksahayak.gov.in',
    },
    admin: {
      title: lang === 'hi' ? 'प्रशासनिक कमान कंसोल' : 'Administrator Command Console',
      subtitle:
        lang === 'hi'
          ? 'प्रशासनिक निगरानी, अधिकारी प्रबंधन एवं संपूर्ण ऑडिट लॉग्स'
          : 'Executive governance, officer appointments, SLA monitoring, & audit inspection',
      badge: lang === 'hi' ? 'कार्यकारी प्रशासन' : 'Admin Authority',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: ShieldAlert,
      iconBg: 'bg-amber-600 text-white',
      emailLabel:
        lang === 'hi'
          ? 'प्रशासनिक ईमेल आईडी (@nagriksahayak.gov.in)'
          : 'Administrative Authority Email ID',
      emailPlaceholder: 'admin@nagriksahayak.gov.in',
    },
  };

  const currentPortal = portalConfig[activeRole] || portalConfig.citizen;
  const PortalIcon = currentPortal.icon;

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200/80">
        {/* Three Portal Switcher Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-center">
          <button
            type="button"
            onClick={() => handlePortalSwitch('citizen')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeRole === 'citizen'
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'hi' ? 'नागरिक' : 'Citizen'}
          </button>
          <button
            type="button"
            onClick={() => handlePortalSwitch('officer')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeRole === 'officer'
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'hi' ? 'अधिकारी' : 'Officer'}
          </button>
          <button
            type="button"
            onClick={() => handlePortalSwitch('admin')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeRole === 'admin'
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'hi' ? 'प्रशासक' : 'Admin'}
          </button>
        </div>

        {/* Portal Header */}
        <div className="text-center space-y-2">
          <div
            className={`inline-flex w-12 h-12 rounded-2xl ${currentPortal.iconBg} items-center justify-center shadow-md mb-1`}
          >
            <PortalIcon className="w-6 h-6" />
          </div>
          <div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentPortal.badgeColor} mb-1`}
            >
              {currentPortal.badge}
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950">
              {currentPortal.title}
            </h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            {currentPortal.subtitle}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {currentPortal.emailLabel}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={currentPortal.emailPlaceholder}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {lang === 'hi' ? 'पासवर्ड' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>{lang === 'hi' ? 'सत्यापन हो रहा है...' : 'Verifying credentials...'}</span>
            ) : (
              <>
                <span>
                  {lang === 'hi'
                    ? `${currentPortal.badge} में प्रवेश करें`
                    : `Sign In to ${currentPortal.badge}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Role-Specific Notices & Registration Link */}
        {activeRole === 'citizen' && (
          <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
            {lang === 'hi' ? 'खाता नहीं है?' : "Don't have a citizen account?"}{' '}
            <Link to="/register" className="text-teal-600 font-bold hover:underline">
              {lang === 'hi' ? 'नागरिक पंजीकरण करें' : 'Register as Citizen'}
            </Link>
          </div>
        )}

        {activeRole === 'officer' && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              {lang === 'hi'
                ? 'विभागीय अधिकारी खाते सक्षम प्रशासनिक प्राधिकारी द्वारा आवंटित किए जाते हैं। सार्वजनिक पंजीकरण उपलब्ध नहीं है।'
                : 'Officer accounts are created and provisioned by the Administrator. Public officer registration is disabled.'}
            </span>
          </div>
        )}

        {activeRole === 'admin' && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {lang === 'hi'
                ? 'प्रशासनिक कमान कंसोल पर सभी गतिविधियां ऑडिट एवं सुरक्षा मानकों के तहत रिकॉर्ड की जाती हैं।'
                : 'Administrative console access is strictly restricted to authorized executives. All actions are logged.'}
            </span>
          </div>
        )}

        {/* Demo Fast-Fill Box for development evaluation only */}
        {isDevMode && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              {lang === 'hi' ? 'त्वरित डेमो परीक्षण क्रेडेंशियल' : 'Quick Fill Demo Credentials'}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  handlePortalSwitch('citizen');
                  setDemoCredentials('citizen');
                }}
                className={`py-1 px-2 rounded border text-[11px] font-medium transition-colors ${
                  activeRole === 'citizen'
                    ? 'border-teal-400 bg-teal-50 text-teal-800'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                Citizen
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePortalSwitch('officer');
                  setDemoCredentials('officer');
                }}
                className={`py-1 px-2 rounded border text-[11px] font-medium transition-colors ${
                  activeRole === 'officer'
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                Officer
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePortalSwitch('admin');
                  setDemoCredentials('admin');
                }}
                className={`py-1 px-2 rounded border text-[11px] font-medium transition-colors ${
                  activeRole === 'admin'
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                Admin
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
