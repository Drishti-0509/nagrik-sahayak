import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

const LanguageSelector = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-sm">
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-all ${
          lang === 'en'
            ? 'bg-navy-800 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-label="Switch to English"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>English</span>
      </button>
      <button
        type="button"
        onClick={() => setLang('hi')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-all ${
          lang === 'hi'
            ? 'bg-navy-800 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-label="हिंदी में बदलें"
      >
        <span>हिंदी</span>
      </button>
    </div>
  );
};

export default LanguageSelector;
