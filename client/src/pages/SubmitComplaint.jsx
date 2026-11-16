import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../services/api';
import {
  FileText,
  Sparkles,
  MapPin,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Info,
  Loader2,
  Building2,
  Image as ImageIcon,
  UploadCloud,
  X,
  CopyCheck,
} from 'lucide-react';

const CATEGORIES = [
  'Water Supply',
  'Electricity',
  'Roads and Infrastructure',
  'Sanitation and Waste Management',
  'Public Health',
  'Education',
  'Public Safety',
  'Transport',
  'Other',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const CATEGORY_DEPARTMENT_MAP = {
  'Water Supply': 'Water Supply & Sewerage',
  'Electricity': 'Electricity & Energy',
  'Roads and Infrastructure': 'Roads & Public Infrastructure',
  'Sanitation and Waste Management': 'Sanitation & Waste Management',
  'Public Health': 'Public Health & Healthcare',
  'Education': 'Education & Schools',
  'Public Safety': 'Public Safety & Law Enforcement',
  'Transport': 'Transport & Traffic Management',
  'Other': 'General Public Administration',
};

const findMatchingDepartmentId = (cat, deptList) => {
  if (!cat || !Array.isArray(deptList) || deptList.length === 0) return '';
  const expectedName = CATEGORY_DEPARTMENT_MAP[cat];
  if (!expectedName) return '';
  const matched = deptList.find(
    (d) =>
      d.name?.toLowerCase().startsWith(expectedName.toLowerCase()) ||
      d.name?.toLowerCase() === expectedName.toLowerCase() ||
      (d.categories && d.categories.includes(cat))
  );
  return matched ? matched._id : '';
};

const SubmitComplaint = () => {
  const { t } = useLanguage();
  const { fetchNotifications } = useNotifications();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    departmentId: '',
    description: '',
    address: '',
    pincode: '',
    priority: 'Medium',
    evidenceImage: '',
  });

  const [departments, setDepartments] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [similarComplaints, setSimilarComplaints] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        if (res.data?.success && Array.isArray(res.data.departments)) {
          setDepartments(res.data.departments);
          setFormData((prev) => {
            if (prev.category && !prev.departmentId) {
              const matchedId = findMatchingDepartmentId(prev.category, res.data.departments);
              if (matchedId) return { ...prev, departmentId: matchedId };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Departments fetch failed:', err);
      }
    };
    fetchDepartments();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'category') {
      const matchedDeptId = findMatchingDepartmentId(value, departments);
      setFormData((prev) => ({
        ...prev,
        category: value,
        departmentId: matchedDeptId,
      }));
    } else if (name === 'departmentId') {
      if (value) {
        const selectedDept = departments.find((d) => d._id === value);
        let matchedCat = '';
        if (selectedDept) {
          matchedCat =
            Object.keys(CATEGORY_DEPARTMENT_MAP).find(
              (cat) =>
                CATEGORY_DEPARTMENT_MAP[cat].toLowerCase() === selectedDept.name?.toLowerCase() ||
                (selectedDept.categories && selectedDept.categories.includes(cat))
            ) || '';
        }
        setFormData((prev) => ({
          ...prev,
          departmentId: value,
          category: matchedCat || prev.category,
        }));
      } else {
        setFormData((prev) => ({ ...prev, departmentId: '' }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed. SVG and unsupported formats are rejected.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      e.target.value = '';
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setFormData((prev) => ({ ...prev, evidenceImage: loadEvt.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, evidenceImage: '' }));
  };

  // AI Triage Assistant call
  const handleAnalyzeAI = async () => {
    if (!formData.description || formData.description.trim().length < 5) {
      setError('Please provide at least a brief description of the issue for AI analysis.');
      return;
    }

    setError('');
    setAnalyzingAI(true);
    try {
      const res = await api.post('/ai/analyze', {
        title: formData.title,
        description: formData.description,
        location: { address: formData.address },
      });

      if (res.data.success && res.data.analysis) {
        setAiAnalysis(res.data.analysis);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'AI analysis unavailable. Please fill manually.');
    } finally {
      setAnalyzingAI(false);
    }
  };

  const handleApplyAISuggestions = () => {
    if (!aiAnalysis) return;
    const targetCategory = aiAnalysis.categorySuggestion || formData.category;
    const matchedDeptId = findMatchingDepartmentId(targetCategory, departments);

    setFormData((prev) => ({
      ...prev,
      category: targetCategory,
      priority: aiAnalysis.prioritySuggestion || prev.priority,
      departmentId: matchedDeptId || prev.departmentId,
    }));
  };

  const handleCheckDuplicates = async () => {
    if (!formData.title?.trim() || !formData.description?.trim()) {
      setError('Please provide at least a title and description to check for duplicates.');
      return;
    }

    setCheckingDuplicates(true);
    setError('');
    try {
      const res = await api.post('/complaints/check-duplicates', {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category || undefined,
        departmentId: formData.departmentId || undefined,
      });

      if (res.data?.success && res.data?.data) {
        const found = res.data.data.duplicates || [];
        setSimilarComplaints(found);
        setDuplicateChecked(true);
      }
    } catch (err) {
      console.warn('Duplicate check warning:', err);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (!formData.title || !formData.category || !formData.description || !formData.address) {
      setError('Please complete all required fields (*).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        location: {
          address: formData.address,
          pincode: formData.pincode,
        },
      };

      if (formData.departmentId) {
        payload.departmentId = formData.departmentId;
      }
      if (formData.evidenceImage) {
        payload.evidenceImage = formData.evidenceImage;
      }

      const res = await api.post('/complaints', payload);

      if (res.data.success && res.data.complaint) {
        fetchNotifications();
        setSuccessMsg(res.data.message || 'Grievance submitted successfully!');
        setTimeout(() => {
          navigate(`/complaints/${res.data.complaint._id}`);
        }, 1200);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to submit grievance. Please verify details and retry.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase">
          Citizen Redressal Filing
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
          {t('submitTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          {t('submitSubtitle')}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="civic-card p-6 sm:p-8 space-y-5">
          {/* Headline */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              {t('formTitle')} *
            </label>
            <input
              type="text"
              required
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder={t('formTitlePlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Description & AI Assistant / Duplicate Check Triggers */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-semibold text-slate-800">
                {t('formDescription')} *
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckDuplicates}
                  disabled={checkingDuplicates || !formData.title.trim() || !formData.description.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {checkingDuplicates ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                      <span>{t('btnCheckingDuplicates')}</span>
                    </>
                  ) : (
                    <>
                      <CopyCheck className="w-3.5 h-3.5 text-amber-700" />
                      <span>{t('btnCheckDuplicates')}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleAnalyzeAI}
                  disabled={analyzingAI || !formData.description.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {analyzingAI ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                      <span>{t('analyzingAI')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>{t('btnAnalyzeAI')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <textarea
              required
              rows={4}
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('formDescriptionPlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* AI Recommendation Banner */}
          {aiAnalysis && (
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-teal-50/70 to-blue-50/70 border border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  <span className="font-bold text-xs text-navy-900">
                    {t('aiSuggestionTitle')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAISuggestions}
                  className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] shadow-sm transition-colors"
                >
                  {t('btnApplyAISuggestions')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">{t('aiCategorySuggested')}</span>
                  <p className="font-bold text-slate-800">{aiAnalysis.categorySuggestion}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">{t('aiPrioritySuggested')}</span>
                  <p className="font-bold text-slate-800">{aiAnalysis.prioritySuggestion}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 font-medium">{t('aiDepartmentSuggested')}</span>
                  <p className="font-bold text-slate-800">{aiAnalysis.departmentSuggestion}</p>
                </div>
                {aiAnalysis.summary && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-medium">{t('aiSummarySuggested')}</span>
                    <p className="text-slate-700 italic mt-0.5">{aiAnalysis.summary}</p>
                  </div>
                )}
                {aiAnalysis.nextAction && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-medium">{t('aiNextActionSuggested')}</span>
                    <p className="text-slate-700 mt-0.5">{aiAnalysis.nextAction}</p>
                  </div>
                )}
              </div>

              {aiAnalysis.isFallback && (
                <div className="pt-2 border-t border-teal-200/60 flex items-center gap-1.5 text-[11px] text-amber-800">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{t('aiFallbackNotice')}</span>
                </div>
              )}
            </div>
          )}

          {/* AI Duplicate Detection Advisory Banner */}
          {similarComplaints.length > 0 && (
            <div className="p-4 sm:p-5 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-amber-950">
                    {t('duplicateWarningTitle')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSimilarComplaints([])}
                  className="text-amber-800 hover:text-amber-950 p-1 rounded-md"
                  title="Dismiss warning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-amber-900 leading-relaxed">
                {t('duplicateWarningDesc')}
              </p>

              <div className="space-y-2 mt-2">
                {similarComplaints.map((dup) => (
                  <div
                    key={dup.id || dup.trackingId}
                    className="p-3 bg-white rounded-lg border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-teal-800">{dup.trackingId}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {dup.status}
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium">{dup.title}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {Math.round((dup.similarity || 0) * 100)}% {t('similarityMatchBadge')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-amber-200/80">
                <p className="text-[11px] text-amber-800 italic">
                  * You can still submit your grievance if your specific situation requires separate action.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all self-end sm:self-auto"
                >
                  {t('btnSubmitAnyway')}
                </button>
              </div>
            </div>
          )}

          {duplicateChecked && similarComplaints.length === 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t('noDuplicatesFound')}</span>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateChecked(false)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Category, Priority & Department Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                {t('formCategory')} *
              </label>
              <select
                required
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
              >
                <option value="">{t('formCategorySelect')}</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                {t('formPriority')}
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                {t('formDepartment')}
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white truncate"
                >
                  <option value="">{t('formDepartmentSelect')}</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Location fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                {t('formAddress')} *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder={t('formAddressPlaceholder')}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                {t('formPincode')}
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder={t('formPincodePlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Photo Evidence Upload */}
          <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 space-y-3">
            <label className="block text-xs font-semibold text-slate-800">
              {t('attachEvidence')}
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-300 bg-white hover:bg-teal-50 text-teal-800 text-xs font-semibold transition-colors shadow-sm shrink-0">
                <UploadCloud className="w-4 h-4 text-teal-600" />
                <span>{t('uploadPhotoHint')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFile}
                  className="hidden"
                />
              </label>

              {formData.evidenceImage && (
                <div className="relative inline-flex items-center gap-3 p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                  <img
                    src={formData.evidenceImage}
                    alt="Evidence Preview"
                    className="h-14 w-20 object-cover rounded-md border border-slate-100"
                  />
                  <div className="pr-2">
                    <p className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Image Attached
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 underline mt-0.5"
                    >
                      {t('removePhoto')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('btnSubmitting')}</span>
                </>
              ) : (
                <>
                  <span>{t('btnSubmitGrievance')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SubmitComplaint;
