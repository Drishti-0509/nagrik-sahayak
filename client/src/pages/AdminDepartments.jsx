import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import {
  Building2,
  PlusCircle,
  Clock,
  Edit2,
  CheckCircle,
  XCircle,
  Loader2,
  X,
} from 'lucide-react';

const AdminDepartments = () => {
  const { t } = useLanguage();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    categories: '',
    slaLow: 120,
    slaMedium: 72,
    slaHigh: 48,
    slaUrgent: 24,
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments?includeInactive=true');
      if (res.data.success) {
        setDepartments(res.data.departments || []);
      }
    } catch (err) {
      console.error('[AdminDepartments] Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleOpenCreate = () => {
    setEditingDept(null);
    setForm({
      name: '',
      code: '',
      description: '',
      categories: '',
      slaLow: 120,
      slaMedium: 72,
      slaHigh: 48,
      slaUrgent: 24,
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      categories: dept.categories ? dept.categories.join(', ') : '',
      slaLow: dept.slaHours?.Low || 120,
      slaMedium: dept.slaHours?.Medium || 72,
      slaHigh: dept.slaHours?.High || 48,
      slaUrgent: dept.slaHours?.Urgent || 24,
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.name || !form.code) {
      setErrorMsg('Department name and code are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        categories: form.categories
          ? form.categories.split(',').map((c) => c.trim()).filter(Boolean)
          : [],
        slaHours: {
          Low: Number(form.slaLow),
          Medium: Number(form.slaMedium),
          High: Number(form.slaHigh),
          Urgent: Number(form.slaUrgent),
        },
      };

      if (editingDept) {
        await api.put(`/departments/${editingDept._id}`, payload);
      } else {
        await api.post('/departments', payload);
      }

      setShowModal(false);
      fetchDepartments();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save department.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (dept) => {
    try {
      await api.put(`/departments/${dept._id}`, { isActive: !dept.isActive });
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update department status.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Department & SLA Management</h1>
          <p className="text-xs text-slate-500">
            Configure municipal departments, jurisdictional categories, and statutory SLA response hours
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add New Department</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">{t('loading')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div key={dept._id} className="civic-card p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {dept.code}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      dept.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {dept.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{dept.name}</h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {dept.description || 'Public service grievance wing.'}
                  </p>
                </div>

                {/* Categories */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                    Categories:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {dept.categories?.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-teal-50 text-teal-800 font-medium"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* SLA Grid */}
                <div className="p-3 bg-slate-50 rounded-lg text-[11px] space-y-1">
                  <span className="font-semibold text-slate-700 block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    <span>Statutory SLA Deadlines:</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-slate-600">
                    <span>Urgent: {dept.slaHours?.Urgent || 24}h</span>
                    <span>High: {dept.slaHours?.High || 48}h</span>
                    <span>Medium: {dept.slaHours?.Medium || 72}h</span>
                    <span>Low: {dept.slaHours?.Low || 120}h</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-medium">
                  Total: {dept.totalComplaints || 0} • Pending: {dept.pendingComplaints || 0}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(dept)}
                    className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-[11px]"
                  >
                    {dept.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(dept)}
                    className="px-2.5 py-1 rounded bg-teal-50 text-teal-800 hover:bg-teal-100 font-semibold text-[11px] flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span>{editingDept ? 'Edit Department' : 'Create Public Department'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <p className="p-2.5 rounded bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {errorMsg}
              </p>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Water Works Division"
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. WWD"
                    className="w-full p-2.5 border border-slate-300 rounded-lg uppercase focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Jurisdiction and operational responsibilities..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Covered Categories (Comma-separated)
                </label>
                <input
                  type="text"
                  value={form.categories}
                  onChange={(e) => setForm({ ...form, categories: e.target.value })}
                  placeholder="Water Supply, Pipeline Leakage, Sewage"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              {/* SLA Hours Inputs */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Configured SLA Hours by Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Urgent (hrs)</span>
                    <input
                      type="number"
                      min={1}
                      value={form.slaUrgent}
                      onChange={(e) => setForm({ ...form, slaUrgent: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">High (hrs)</span>
                    <input
                      type="number"
                      min={1}
                      value={form.slaHigh}
                      onChange={(e) => setForm({ ...form, slaHigh: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Medium (hrs)</span>
                    <input
                      type="number"
                      min={1}
                      value={form.slaMedium}
                      onChange={(e) => setForm({ ...form, slaMedium: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Low (hrs)</span>
                    <input
                      type="number"
                      min={1}
                      value={form.slaLow}
                      onChange={(e) => setForm({ ...form, slaLow: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDepartments;
