import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Building2,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Lock,
  Mail,
  Phone,
} from 'lucide-react';

const AdminUsers = () => {
  const { t } = useLanguage();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Officer Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [officerForm, setOfficerForm] = useState({
    name: '',
    email: '',
    password: '',
    departmentId: '',
    phone: '',
  });
  const [submittingOfficer, setSubmittingOfficer] = useState(false);
  const [modalErr, setModalErr] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await api.get(`/users?${params.toString()}`);
      if (res.data.success) {
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.error('[AdminUsers] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, searchTerm]);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        if (res.data.success) setDepartments(res.data.departments || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDepts();
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (user) => {
    try {
      const res = await api.patch(`/users/${user._id}/status`, {
        isActive: !user.isActive,
      });
      if (res.data.success) {
        setUsers((prev) =>
          prev.map((u) => (u._id === user._id ? { ...u, isActive: res.data.user.isActive } : u))
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    setModalErr('');

    if (!officerForm.name || !officerForm.email || !officerForm.password || !officerForm.departmentId) {
      setModalErr('All required fields (*) must be provided.');
      return;
    }

    setSubmittingOfficer(true);
    try {
      const res = await api.post('/users/officers', officerForm);
      if (res.data.success) {
        setShowCreateModal(false);
        setOfficerForm({ name: '', email: '', password: '', departmentId: '', phone: '' });
        fetchUsers();
      }
    } catch (err) {
      setModalErr(err.response?.data?.message || 'Failed to create officer account');
    } finally {
      setSubmittingOfficer(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">{t('navUsers')}</h1>
          <p className="text-xs text-slate-500">
            System accounts registry (Citizens, Departmental Officers, and Administrators)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Department Officer</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="civic-card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name, email, phone..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none"
        >
          <option value="all">Role: All Roles</option>
          <option value="citizen">Citizens</option>
          <option value="officer">Department Officers</option>
          <option value="admin">Administrators</option>
        </select>
      </div>

      {/* Users table */}
      <div className="civic-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">{t('loading')}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">User Details</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Assigned Department</th>
                  <th className="py-3 px-4 font-semibold">Account Status</th>
                  <th className="py-3 px-4 font-semibold">Registered</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-rose-100 text-rose-800'
                            : u.role === 'officer'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.department?.name || <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {u.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-500" />
                            <span>Deactivated</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                            u.isActive
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Department Officer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-600" />
                <span>Create Department Officer</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalErr && (
              <p className="p-2.5 rounded bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {modalErr}
              </p>
            )}

            <form onSubmit={handleCreateOfficer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Officer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={officerForm.name}
                  onChange={(e) => setOfficerForm({ ...officerForm, name: e.target.value })}
                  placeholder="e.g. Inspector Rajesh Verma"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Government / Official Email *
                </label>
                <input
                  type="email"
                  required
                  value={officerForm.email}
                  onChange={(e) => setOfficerForm({ ...officerForm, email: e.target.value })}
                  placeholder="officer.verma@nagriksahayak.gov.in"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Public Department *
                </label>
                <select
                  required
                  value={officerForm.departmentId}
                  onChange={(e) => setOfficerForm({ ...officerForm, departmentId: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Temporary Password * (min. 6 chars)
                </label>
                <input
                  type="password"
                  required
                  value={officerForm.password}
                  onChange={(e) => setOfficerForm({ ...officerForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={officerForm.phone}
                  onChange={(e) => setOfficerForm({ ...officerForm, phone: e.target.value })}
                  placeholder="9812345678"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOfficer}
                  className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingOfficer ? 'Creating...' : 'Create Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
