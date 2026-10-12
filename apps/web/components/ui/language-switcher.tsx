'use client';
import { Languages } from 'lucide-react';
import { LOCALES, useI18n } from '@/lib/i18n';

export function LanguageSwitcher({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-0.5 ${className}`} role="group" aria-label="Language">
      {!compact && <Languages size={14} className="ml-1.5 text-slate-400" />}
      {LOCALES.map((l) => (
        <button key={l.code} onClick={() => setLocale(l.code)} className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${locale === l.code ? 'bg-ember-500/20 text-ember-300' : 'text-slate-400 hover:text-slate-100'}`} aria-pressed={locale === l.code} lang={l.code === 'zh' ? 'zh-CN' : 'en'}>
          {l.native}
        </button>
      ))}
    </div>
  );
}
