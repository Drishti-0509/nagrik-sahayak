import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { Bell, CheckCheck, FileText, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';

const NotificationsPage = () => {
  const { isOfficer } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications, loading, error } =
    useNotifications();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 flex items-center gap-2">
            <Bell className="w-6 h-6 text-teal-600" />
            <span>{t('navNotifications')}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status alerts, milestone updates, and remarks from investigating officers
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold border border-teal-200 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Notifications list */}
      <div className="civic-card divide-y divide-slate-100 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-7 h-7 text-teal-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">{t('loading')}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No notifications available.
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
                }
              }}
              className={`p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                !n.isRead ? 'bg-teal-50/40' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    !n.isRead ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">{n.title}</h3>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-teal-600" />}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                    {n.trackingId && (
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                        {n.trackingId}
                      </span>
                    )}
                    <span>
                      {new Date(n.createdAt).toLocaleDateString()} at{' '}
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {n.relatedComplaint && (
                <ExternalLink className="w-4 h-4 text-slate-300 hover:text-slate-600 shrink-0 self-center" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
