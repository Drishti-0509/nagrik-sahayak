import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Shield, PhoneCall, HelpCircle, FileCheck2, ExternalLink } from 'lucide-react';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-navy-900 pt-12 pb-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-teal-400" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                {t('brandName')}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('brandTagline')} — Dedicated to transparent, accountable, and legally enforced citizen grievance resolution across all civic municipal services.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-800 text-[11px] text-teal-300">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Right to Public Service (RTS) Compliant</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Quick Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="hover:text-white transition-colors">{t('navHome')}</Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-white transition-colors">{t('navHowItWorks')}</Link>
              </li>
              <li>
                <Link to="/departments" className="hover:text-white transition-colors">{t('navDepartments')}</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">{t('navAbout')}</Link>
              </li>
              <li>
                <Link to="/complaints/submit" className="text-teal-400 hover:text-teal-300 font-medium">
                  {t('navSubmitComplaint')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Civic Helplines Directory */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
              <span>National Civic Helplines</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between border-b border-navy-900 pb-1">
                <span>National Emergency:</span>
                <span className="text-white font-mono font-bold">112</span>
              </div>
              <div className="flex justify-between border-b border-navy-900 pb-1">
                <span>Power & Electricity:</span>
                <span className="text-white font-mono font-bold">1912</span>
              </div>
              <div className="flex justify-between border-b border-navy-900 pb-1">
                <span>Citizen Redressal Toll Free:</span>
                <span className="text-teal-400 font-mono font-bold">1800-11-2026</span>
              </div>
              <div className="flex justify-between">
                <span>Water Supply Helpline:</span>
                <span className="text-white font-mono font-bold">1916</span>
              </div>
            </div>
          </div>

          {/* Integrity & Tech */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Governance Commitment</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every registered grievance is assigned a verifiable tracking reference with legally binding SLA deadlines. Tamper-evident audit logs record every officer milestone.
            </p>
            <div className="p-3 rounded-lg bg-navy-900/60 border border-navy-800 text-[11px] text-slate-300">
              <p className="font-semibold text-white">AI-Assisted Public Service</p>
              <p className="text-slate-400 mt-0.5">Automated triage classification with deterministic civic safety fallback.</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-navy-900/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} Nagrik Sahayak (नागरिक सहायक). Public Civic Tech Initiative.</p>
          <div className="flex items-center gap-4 text-xs">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Citizen Charter</span>
            <span>•</span>
            <span>Terms of Redressal</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
