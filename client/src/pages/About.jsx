import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Shield, Lock, FileCheck, Users, Eye, CheckCircle2 } from 'lucide-react';

const About = () => {
  const { t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold text-teal-700 tracking-wider uppercase">
          Citizen-First Civic Technology
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-950">
          About Nagrik Sahayak (नागरिक सहायक)
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Bridging the gap between citizens and municipal authorities through intelligent technology, verifiable accountability, and enforceable service standards.
        </p>
      </div>

      {/* Mission cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="civic-card p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <Eye className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Total Transparency</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every complaint receives a public reference ID. Every status change, assignment, and officer note is permanently timestamped in an immutable timeline audit trail.
          </p>
        </div>

        <div className="civic-card p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Strict Data Privacy</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Citizens can only access their own records. Mass-assignment and ID tampering are blocked by server-side ownership authorization. Personal numbers are never exposed publicly.
          </p>
        </div>

        <div className="civic-card p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <FileCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">SLA Enforcement</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Statutory redressal deadlines are calculated from the moment of submission. Overdue tickets automatically trigger escalation flags visible on high-level administrative consoles.
          </p>
        </div>
      </div>

      {/* Technology & Architecture section */}
      <div className="civic-card p-8 space-y-6">
        <h2 className="text-xl font-bold text-navy-900">Digital Architecture Highlights</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">Google Gemini AI Engine</span>
              <span>Intelligent triage classification, summary extraction, and priority suggestion with deterministic heuristic fallback.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">MERN Enterprise Stack</span>
              <span>Node.js / Express backend with Mongoose ODM and a lightweight React/Vite/Tailwind responsive client.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">Bilingual Internationalization</span>
              <span>First-class English and Hindi (हिंदी) translation system for universal accessibility across diverse communities.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block">Role-Based Access Control</span>
              <span>Fine-grained permissions strictly separating Citizen, Department Officer, and System Administrator privileges.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
