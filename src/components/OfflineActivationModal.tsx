import React, { useState } from 'react';
import {
  formatActivationKeyInput,
  LicenseStatus,
  saveActivatedLicense,
} from '../utils/offlineLicenseEngine';
import {
  Lock,
  KeyRound,
  Copy,
  ShieldAlert,
  Cpu,
} from 'lucide-react';

interface OfflineActivationModalProps {
  license: LicenseStatus;
  onActivated: (newStatus: LicenseStatus) => void;
}

export const OfflineActivationModal: React.FC<OfflineActivationModalProps> = ({
  license,
  onActivated,
}) => {
  const [enteredKey, setEnteredKey] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyMachineId = () => {
    try {
      navigator.clipboard.writeText(license.machineId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleVerifyAndActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const result = saveActivatedLicense(license.machineId, enteredKey);
    if (!result) {
      setErrorMsg(
        'رمز فعال‌سازی وارد شده برای سخت‌افزار این کامپیوتر معتبر نیست! برنامه تا زمان وارد کردن رمز صحیح این سیستم باز نخواهد شد.'
      );
      return;
    }
    onActivated(result);
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-4 md:p-6 select-none">
      <div className="max-w-xl w-full">
        <div className="bg-white border-2 border-slate-300 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-950 text-white px-6 py-5 flex items-center gap-3.5 border-b border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-amber-400/50 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden shadow-md">
              <img
                src="/arka-logo.jpg"
                alt="لوگو آرکا (ARKA)"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-extrabold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>قفل سخت‌افزاری و فعال‌سازی آفلاین — آرکا (ARKA) ویندوز</span>
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                این نرم‌افزار هنوز روی این کامپیوتر فعال نشده است. تا زمان ثبت رمز فعال‌سازی معتبر، امکان ورود به برنامه وجود ندارد.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyAndActivate} className="p-6 space-y-5">
            {/* Hardware Fingerprint Details */}
            <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-700" />
                <span>مشخصات سخت‌افزاری شناسایی‌شده این سیستم ویندوز:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono-num">
                <div>سیستم‌عامل: {license.hardwareSpecs.platform}</div>
                <div>هسته‌های پردازنده (CPU): {license.hardwareSpecs.cpuCores} Cores</div>
                <div>حافظه رم (RAM): ~{license.hardwareSpecs.ramGb} GB</div>
                <div>نمایشگر: {license.hardwareSpecs.screenSpec}</div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono-num truncate">
                پردازنده گرافیکی (GPU): {license.hardwareSpecs.gpuRenderer}
              </div>
            </div>

            {/* Step 1: Hardware Machine ID */}
            <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200 space-y-2.5">
              <div className="text-xs font-bold text-slate-800">
                ۱. شناسه سخت‌افزاری اختصاصی این کامپیوتر (System Hardware ID):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={license.machineId}
                  aria-label="شناسه سخت‌افزاری سیستم"
                  className="flex-1 min-w-[200px] px-4 py-2.5 text-center font-mono-num text-lg font-extrabold tracking-widest bg-white border-2 border-amber-400 rounded-lg text-slate-950"
                />
                <button
                  type="button"
                  onClick={handleCopyMachineId}
                  className="px-4 py-3 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedId ? 'کپی شد!' : 'کپی شناسه سخت‌افزار'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                این شناسه مستقیماً از سخت‌افزار این کامپیوتر استخراج شده و روی هر ویندوز متفاوت است. برای دریافت رمز فعال‌سازی، این شناسه را برای پشتیبانی ارسال نمایید.
              </p>
            </div>

            {/* Step 2: 16-Digit Offline Activation Key */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                ۲. رمز فعال‌سازی ۱۶ رقمی آفلاین (XXXX-XXXX-XXXX-XXXX):
              </label>
              <input
                type="text"
                dir="ltr"
                value={enteredKey}
                onChange={(e) =>
                  setEnteredKey(formatActivationKeyInput(e.target.value))
                }
                placeholder="XXXX-XXXX-XXXX-XXXX"
                aria-label="کد فعال‌سازی آفلاین"
                className="w-full px-4 py-3 text-center font-mono-num text-xl font-extrabold tracking-widest bg-white border-2 border-blue-400 focus:border-blue-700 rounded-lg text-blue-950 outline-none"
              />
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-5 text-sm font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              <span>ثبت رمز فعال‌سازی و بازگشایی نرم‌افزار روی این کامپیوتر</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
