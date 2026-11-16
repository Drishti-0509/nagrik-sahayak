import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { User, Mail, Phone, MapPin, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setLoading(true);

    try {
      const res = await updateProfile({ name, phone, address });
      if (res.success) {
        setProfileMsg('Profile information updated successfully.');
      } else {
        setProfileErr(res.message || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileErr(err.response?.data?.message || 'Error saving profile.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (newPassword.length < 6) {
      setPasswordErr('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErr('New passwords do not match.');
      return;
    }

    try {
      const res = await api.put('/auth/password', { currentPassword, newPassword });
      if (res.data.success) {
        setPasswordMsg('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordErr(err.response?.data?.message || 'Failed to update password.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">{t('navProfile')}</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your account information and authentication credentials
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info Form */}
        <div className="civic-card p-6 sm:p-8 space-y-5">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-teal-600" />
            <span>Profile Details</span>
          </h2>

          {profileMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{profileMsg}</span>
            </div>
          )}

          {profileErr && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{profileErr}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (Read-only)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role (Assigned)
              </label>
              <input
                type="text"
                disabled
                value={user?.role?.toUpperCase() || ''}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-bold uppercase cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ward / Area Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Update Profile
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="civic-card p-6 sm:p-8 space-y-5">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-600" />
            <span>Change Password</span>
          </h2>

          {passwordMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{passwordMsg}</span>
            </div>
          )}

          {passwordErr && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{passwordErr}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password (min. 6 characters)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
