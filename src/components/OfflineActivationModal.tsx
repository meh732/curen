import React, { useState, useEffect } from 'react';
import arkaLogo from '../assets/arka-logo.jpg';
import {
  ShieldCheck,
  Lock,
  Copy,
  Check,
  KeyRound,
  Cpu,
  AlertTriangle,
  Sparkles,
  ClipboardPaste,
  RefreshCw,
} from 'lucide-react';
import {
  saveActivatedLicense,
  verifyOfflineActivationKey,
  recoverLicenseFromNativeLock,
  loadLicenseStatus,
  LicenseStatus,
} from '../utils/offlineLicenseEngine';

interface OfflineActivationModalProps {
  machineId?: string;
  license?: LicenseStatus;
  onActivated: (status: LicenseStatus) => void;
}

// Convert Persian and Arabic digits to English digits
function toEnglishDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// Format raw digits into 0000-0000-0000-0000
function formatKeyBlocks(digits: string): string {
  const clean = digits.replace(/[^0-9]/g, '').slice(0, 16);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join('-');
}

export const OfflineActivationModal: React.FC<OfflineActivationModalProps> = ({
  machineId: propMachineId,
  license,
  onActivated,
}) => {
  const machineId = propMachineId || license?.machineId || '';
  const [enteredKey, setEnteredKey] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pastedSuccess, setPastedSuccess] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Auto-detect existing hardware license lock on modal open
  useEffect(() => {
    let active = true;
    async function tryAutoRecover() {
      setIsRecovering(true);
      try {
        const ok = await recoverLicenseFromNativeLock();
        if (ok && active) {
          const fresh = loadLicenseStatus();
          if (fresh.isActivated) {
            onActivated(fresh);
            return;
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setIsRecovering(false);
      }
    }
    void tryAutoRecover();
    return () => {
      active = false;
    };
  }, [machineId, onActivated]);

  const handleManualAutoRecover = async () => {
    setIsRecovering(true);
    setErrorMsg('');
    try {
      const ok = await recoverLicenseFromNativeLock();
      if (ok) {
        const fresh = loadLicenseStatus();
        if (fresh.isActivated) {
          onActivated(fresh);
          return;
        }
      }
      setErrorMsg('قفل سخت‌افزاری فعال روی سیستم شناسایی نشد. لطفاً کد ۱۶ رقمی را در کادر زیر وارد فرمایید.');
    } catch {
      setErrorMsg('خطا در بازخوانی قفل سخت‌افزاری سیستم.');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleCopyMachineId = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleKeyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawNormalized = toEnglishDigits(e.target.value);
    const formatted = formatKeyBlocks(rawNormalized);
    setEnteredKey(formatted);
    if (errorMsg) setErrorMsg('');
  };

  const handlePasteKey = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const rawNormalized = toEnglishDigits(text);
          const formatted = formatKeyBlocks(rawNormalized);
          setEnteredKey(formatted);
          setPastedSuccess(true);
          setTimeout(() => setPastedSuccess(false), 2000);
          if (errorMsg) setErrorMsg('');
        }
      }
    } catch {
      // ignore clipboard permission error
    }
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanDigits = enteredKey.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 16) {
      setErrorMsg('لطفاً کد فعال‌سازی ۱۶ رقمی اختصاصی این سیستم را به طور کامل وارد نمایید.');
      return;
    }

    if (!verifyOfflineActivationKey(machineId, enteredKey)) {
      setErrorMsg(
        'رمز فعال‌سازی وارد شده برای سخت‌افزار این کامپیوتر معتبر نیست! برنامه تا زمان وارد کردن رمز صحیح این سیستم باز نخواهد شد.'
      );
      return;
    }

    const result = saveActivatedLicense(machineId, enteredKey);
    if (result && result.isActivated) {
      onActivated(result);
    } else {
      setErrorMsg(
        'رمز فعال‌سازی وارد شده برای سخت‌افزار این کامپیوتر معتبر نیست! برنامه تا زمان وارد کردن رمز صحیح این سیستم باز نخواهد شد.'
      );
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-white my-auto">
        {/* Top Security Banner */}
        <div className="bg-gradient-to-l from-emerald-900/90 via-teal-900/80 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={arkaLogo}
              alt="لوگو آرکا"
              className="w-12 h-12 rounded-2xl object-cover bg-white p-0.5 border border-emerald-500/40 shadow-lg shrink-0"
            />
            <div>
              <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold mb-1">
                قفل سخت‌افزاری آفلاین آرکا (ARKA V6)
              </span>
              <h2 className="text-base font-black text-white">
                فعال‌سازی رسمی نرم‌افزار صرافی و حسابداری آرکا (ARKA)
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                فعال‌سازی مستقل با کد ۱۶ رقمی اختصاصی سخت‌افزار
              </p>
            </div>
          </div>
          <Lock className="w-6 h-6 text-amber-400 shrink-0" />
        </div>

        {/* Main Content */}
        <form onSubmit={handleActivate} className="p-5 space-y-4">
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-300 leading-relaxed">
            این نرم‌افزار برای امنیت صرافی به سخت‌افزار اختصاصی این سیستم قفل شده است. برای فعال‌سازی، «شناسه سخت‌افزاری» زیر را کپی کرده و برای فروشنده یا پشتیبانی ارسال نمایید تا کد ۱۶ رقمی فعال‌سازی را دریافت کنید.
          </div>

          {/* Step 1: Machine ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>۱. شناسه سخت‌افزاری اختصاصی این کامپیوتر:</span>
              <span dir="ltr" className="text-[11px] text-slate-400 font-mono">(System Hardware ID)</span>
            </label>
            <div className="flex items-center gap-2">
              <div
                dir="ltr"
                className="flex-1 bg-slate-950 border-2 border-amber-500/60 rounded-xl px-4 py-2.5 text-center font-mono text-xl font-black tracking-widest text-amber-400 select-all shadow-inner"
              >
                {machineId}
              </div>
              <button
                type="button"
                onClick={handleCopyMachineId}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {copiedId ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>کپی شناسه سخت‌افزار</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              این شناسه مستقیماً از سخت‌افزار این کامپیوتر استخراج شده و روی هر سیستم متفاوت است.
            </p>
          </div>

          {/* Step 2: 16-digit Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>۲. رمز فعال‌سازی ۱۶ رقمی آفلاین:</span>
              </label>
              <button
                type="button"
                onClick={handlePasteKey}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>{pastedSuccess ? 'جای‌گذاری شد' : 'چسباندن کد (Paste)'}</span>
              </button>
            </div>
            <input
              dir="ltr"
              type="text"
              inputMode="numeric"
              pattern="[0-9\-]*"
              value={enteredKey}
              onChange={handleKeyInputChange}
              placeholder="0000-0000-0000-0000"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-slate-950 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-xl px-4 py-3 text-center font-mono text-xl font-black tracking-widest text-emerald-300 placeholder:text-slate-700 focus:outline-none transition shadow-inner"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              کد ۱۶ رقمی که از فروشنده دریافت کرده‌اید را در کادر بالا وارد یا جای‌گذاری (Paste) کنید.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>ثبت رمز فعال‌سازی و بازگشایی نرم‌افزار روی این کامپیوتر</span>
            </button>

            <button
              type="button"
              onClick={handleManualAutoRecover}
              disabled={isRecovering}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isRecovering ? 'animate-spin' : ''}`} />
              <span>
                {isRecovering
                  ? 'در حال خواندن قفل دائمی سخت‌افزار...'
                  : 'شناسایی خودکار قفل سخت‌افزار (در صورت فعال‌سازی قبلی این کامپیوتر)'}
              </span>
            </button>
          </div>
        </form>

        {/* Footer Info */}
        <div className="bg-slate-950/90 px-5 py-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            سیستم امنیتی آرکا (نسخه ۶.۰)
          </span>
          <span dir="ltr" className="font-mono text-slate-500">
            ARKA-SEC-V6
          </span>
        </div>
      </div>
    </div>
  );
};
