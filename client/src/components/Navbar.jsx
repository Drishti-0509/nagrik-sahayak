import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import LanguageSelector from './LanguageSelector';
import {
  Shield,
  Bell,
  Menu,
  X,
  User,
  LogOut,
  FileText,
  PlusCircle,
  BarChart3,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

const Navbar = () => {
  const { user, isAuthenticated, logout, isCitizen, isOfficer, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const notifRef = useRef(null);
  const userRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Civic top header bar */}
      <div className="h-1 bg-gradient-to-r from-orange-500 via-white to-emerald-600" />
      <div className="bg-navy-950 text-slate-300 text-xs py-1 px-4 hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span>{t('govIndia')} • {t('brandTagline')}</span>
          <div className="flex items-center gap-4">
            <span className="text-teal-400 font-medium">Toll Free: 1800-11-2026</span>
            <span className="text-slate-400">|</span>
            <span>24x7 Digital Redressal</span>
          </div>
        </div>
      </div>

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <Shield className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-navy-900 group-hover:text-teal-700 transition-colors">
              {t('brandName')}
            </span>
            <span className="block text-[10px] font-semibold text-teal-700 tracking-wider uppercase -mt-1">
              नागरिक सहायक
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors hover:text-navy-900 ${
              location.pathname === '/' ? 'text-teal-600 font-semibold' : 'text-slate-600'
            }`}
          >
            {t('navHome')}
          </Link>
          <Link
            to="/how-it-works"
            className={`text-sm font-medium transition-colors hover:text-navy-900 ${
              location.pathname === '/how-it-works' ? 'text-teal-600 font-semibold' : 'text-slate-600'
            }`}
          >
            {t('navHowItWorks')}
          </Link>
          <Link
            to="/departments"
            className={`text-sm font-medium transition-colors hover:text-navy-900 ${
              location.pathname === '/departments' ? 'text-teal-600 font-semibold' : 'text-slate-600'
            }`}
          >
            {t('navDepartments')}
          </Link>

          {/* Role specific links */}
          {isAuthenticated && isCitizen && (
            <>
              <Link
                to="/dashboard"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/dashboard' ? 'text-teal-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {t('navDashboard')}
              </Link>
              <Link
                to="/complaints/my"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/complaints/my' ? 'text-teal-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {t('navMyComplaints')}
              </Link>
            </>
          )}

          {isAuthenticated && isOfficer && (
            <>
              <Link
                to="/officer/dashboard"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/officer/dashboard' ? 'text-teal-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {t('navDashboard')}
              </Link>
              <Link
                to="/officer/complaints"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/officer/assigned' || location.pathname === '/officer/complaints'
                    ? 'text-teal-600 font-semibold'
                    : 'text-slate-600'
                }`}
              >
                {t('navAssignedComplaints')}
              </Link>
            </>
          )}

          {isAuthenticated && isAdmin && (
            <>
              <Link
                to="/admin/dashboard"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/admin/dashboard' ? 'text-teal-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {t('navDashboard')}
              </Link>
              <Link
                to="/admin/complaints"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/admin/complaints' ? 'text-teal-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {t('navAdminComplaints')}
              </Link>
              <Link
                to="/admin/users"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/admin/users' ? 'text-teal-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {t('navUsers')}
              </Link>
              <Link
                to="/admin/departments"
                className={`text-sm font-medium transition-colors hover:text-navy-900 ${
                  location.pathname === '/admin/departments' ? 'text-teal-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {t('navDepartments')}
              </Link>
            </>
          )}
        </div>

        {/* Right side controls: Language, Notifications, Auth */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <LanguageSelector />

          {/* Citizen Quick Action Button */}
          {isAuthenticated && isCitizen && (
            <Link
              to="/complaints/submit"
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{t('navSubmitComplaint')}</span>
            </Link>
          )}

          {/* Officer Quick Action Button */}
          {isAuthenticated && isOfficer && (
            <Link
              to="/officer/complaints"
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t('heroViewAssigned')}</span>
            </Link>
          )}

          {/* Admin Quick Action Button */}
          {isAuthenticated && isAdmin && (
            <Link
              to="/admin/dashboard"
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{t('heroAdminDashboard')}</span>
            </Link>
          )}

          {/* Notifications Dropdown */}
          {isAuthenticated && (
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">
                      {t('navNotifications')} ({unreadCount} unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs text-teal-700 hover:underline font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => {
                            if (!n.isRead) markAsRead(n._id);
                            if (n.relatedComplaint) {
                              navigate(
                                isOfficer
                                  ? `/officer/complaints/${n.relatedComplaint}`
                                  : `/complaints/${n.relatedComplaint}`
                              );
                              setNotificationsOpen(false);
                            }
                          }}
                          className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                            !n.isRead ? 'bg-teal-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold text-slate-800">
                            <span>{n.title}</span>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-teal-600" />}
                          </div>
                          <p className="text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                    <Link
                      to="/notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-teal-700 font-semibold hover:underline"
                    >
                      View all notifications →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Account / Sign In */}
          {isAuthenticated ? (
            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-navy-800 text-white font-semibold flex items-center justify-center text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline-block text-xs font-semibold text-slate-800 max-w-[110px] truncate">
                  {user?.name}
                </span>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1 overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {user?.role}
                    </span>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{t('navProfile')}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('navLogout')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-semibold text-navy-800 hover:text-teal-700 transition-colors"
              >
                {t('navLogin')}
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {t('navRegister')}
              </Link>
              <Link
                to="/login/officer"
                className="hidden lg:inline-block px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-navy-900 border border-slate-200 rounded-md transition-colors"
                title="Department Officer Login"
              >
                Officer
              </Link>
              <Link
                to="/login/admin"
                className="hidden lg:inline-block px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-navy-900 border border-slate-200 rounded-md transition-colors"
                title="Administrator Console"
              >
                Admin
              </Link>
            </div>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
          <Link
            to="/"
            className="block py-2 text-sm font-semibold text-slate-700 hover:text-teal-700"
          >
            {t('navHome')}
          </Link>
          <Link
            to="/how-it-works"
            className="block py-2 text-sm font-semibold text-slate-700 hover:text-teal-700"
          >
            {t('navHowItWorks')}
          </Link>
          <Link
            to="/departments"
            className="block py-2 text-sm font-semibold text-slate-700 hover:text-teal-700"
          >
            {t('navDepartments')}
          </Link>

          {isAuthenticated && isCitizen && (
            <>
              <Link
                to="/dashboard"
                className="block py-2 text-sm font-semibold text-teal-700"
              >
                {t('navDashboard')}
              </Link>
              <Link
                to="/complaints/submit"
                className="block py-2 text-sm font-semibold text-teal-700"
              >
                {t('navSubmitComplaint')}
              </Link>
              <Link
                to="/complaints/my"
                className="block py-2 text-sm font-semibold text-slate-700"
              >
                {t('navMyComplaints')}
              </Link>
            </>
          )}

          {isAuthenticated && isOfficer && (
            <>
              <Link
                to="/officer/dashboard"
                className="block py-2 text-sm font-semibold text-teal-700"
              >
                {t('navDashboard')}
              </Link>
              <Link
                to="/officer/complaints"
                className="block py-2 text-sm font-semibold text-slate-700"
              >
                {t('navAssignedComplaints')}
              </Link>
            </>
          )}

          {isAuthenticated && isAdmin && (
            <>
              <Link
                to="/admin/dashboard"
                className="block py-2 text-sm font-semibold text-teal-700"
              >
                {t('navDashboard')}
              </Link>
              <Link
                to="/admin/complaints"
                className="block py-2 text-sm font-semibold text-slate-700"
              >
                {t('navAdminComplaints')}
              </Link>
              <Link
                to="/admin/users"
                className="block py-2 text-sm font-semibold text-slate-700"
              >
                {t('navUsers')}
              </Link>
              <Link
                to="/admin/departments"
                className="block py-2 text-sm font-semibold text-slate-700"
              >
                {t('navDepartments')}
              </Link>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <LanguageSelector />
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                {t('navLogout')}
              </button>
            ) : (
              <div className="flex flex-col gap-1.5 items-end text-xs">
                <div className="flex items-center gap-2">
                  <Link to="/login" className="font-semibold text-teal-700">
                    Citizen
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link to="/register" className="font-semibold text-slate-700">
                    Register
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Link to="/login/officer" className="hover:text-teal-700">
                    Officer Portal
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link to="/login/admin" className="hover:text-teal-700">
                    Admin Portal
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
