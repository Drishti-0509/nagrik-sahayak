import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

const HowItWorks = () => {
  const { t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold text-teal-700 tracking-wider uppercase">
          Procedural Transparency
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-950">
          {t('howTitle')}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Understanding the end-to-end civic redressal process, legal service level agreements (SLA), and citizen oversight tools.
        </p>
      </div>

      {/* Process flow */}
      <div className="space-y-6">
        {/* Step 1 */}
        <div className="civic-card p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 font-extrabold flex items-center justify-center shrink-0 text-lg">
            1
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <span>{t('howStep1Title')}</span>
              <Sparkles className="w-4 h-4 text-teal-600" />
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Citizens submit their complaint by specifying the location, description, and title. Our backend integrates Google Gemini AI to analyze the grievance, determine the exact public sector, calculate priority level, and suggest the right civic agency. If AI services are unavailable, a deterministic rule-based NLP system processes the complaint without downtime.
            </p>
            <div className="pt-2 text-xs text-slate-500 font-medium">
              Output: Unique reference ID format <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-teal-700 font-bold">NS-YYYY-XXXXX</code>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="civic-card p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center shrink-0 text-lg">
            2
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <span>{t('howStep2Title')}</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Based on the priority level (Urgent, High, Medium, or Low), an SLA countdown is mathematically calculated and bound to the record. The complaint is routed to the nodal officer of the designated municipal department.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800">
                <span className="font-bold block">Urgent Priority:</span>
                <span>24 Hours Target</span>
              </div>
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                <span className="font-bold block">High Priority:</span>
                <span>48 Hours Target</span>
              </div>
              <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800">
                <span className="font-bold block">Medium Priority:</span>
                <span>72 Hours Target</span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800">
                <span className="font-bold block">Low Priority:</span>
                <span>120 Hours Target</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="civic-card p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-800 font-extrabold flex items-center justify-center shrink-0 text-lg">
            3
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <span>{t('howStep3Title')}</span>
              <FileText className="w-4 h-4 text-purple-600" />
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              As the departmental officer inspects the ground situation, every status change (Under Review, Assigned, In Progress) is automatically logged in an immutable timeline audit trail. Citizens receive in-app notifications and can post follow-up comments directly to the officer.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="civic-card p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center shrink-0 text-lg">
            4
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <span>{t('howStep4Title')}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              When work is completed, the officer files detailed resolution notes and marks the ticket as Resolved. If the citizen finds that the issue was not satisfactorily resolved, they can click <strong>Request Reopen</strong> within 7 days, which immediately re-opens the complaint and flags it for senior administrative audit.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Box */}
      <div className="bg-navy-900 text-white rounded-2xl p-8 text-center space-y-4">
        <h3 className="text-xl sm:text-2xl font-bold">Ready to Experience Transparent Governance?</h3>
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
          File your civic grievance in less than 2 minutes. Receive real-time updates directly on your citizen dashboard.
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold text-xs sm:text-sm shadow-md transition-all"
        >
          <span>Get Started as a Citizen</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default HowItWorks;
