import React, { useState } from 'react';
import { UserAccount, AccountingState } from '../types/accounting';
import { BLANK_ACCOUNTING_STATE } from '../data/initialAccountingData';
import { Sparkles, Building2, UserCheck, Lock, CheckCircle2, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';

interface InitialSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteSetup: (newState: AccountingState, adminUser: UserAccount) => void;
}

export const InitialSetupWizardModal: React.FC<InitialSetupWizardModalProps> = ({
  isOpen,
  onClose,
  onCompleteSetup,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('لطفاً نام صرافی یا شرکت خود را وارد کنید.');
      return;
    }

    if (!fullName.trim() || !username.trim() || !password.trim()) {
      setError('لطفاً تمامی فیلدهای نام کاربر، نام کاربری و رمز عبور را پر کنید.');
      return;
    }

    if (password !== confirmPassword) {
      setError('رمز عبور و تکرار آن با یکدیگر مطابقت ندارند.');
      return;
    }

    const adminUser: UserAccount = {
      id: `usr-admin-${Date.now()}`,
      username: username.trim(),
      passwordHash: password.trim(),
      fullName: fullName.trim(),
      role: 'admin',
      isActive: true,
      lastLogin: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR'),
      permissions: {
        canResetDatabase: true,
        canManageUsers: true,
        canManageCurrencies: true,
        canEditVouchers: true,
        canViewReports: true,
        canIssueInvoices: true,
        canTradeFX: true,
      },
    };

    const newBlankState: AccountingState = {
      ...BLANK_ACCOUNTING_STATE,
      companyName: companyName.trim(),
      users: [adminUser],
      banks: [], // 100% EMPTY - User defines their own real banks
      contacts: [],
      vouchers: [],
      invoices: [],
      fxDeals: [],
      products: [],
      inventoryMovements: [],
      bankStatementEntries: [],
      botLogs: [],
    };

    onCompleteSetup(newBlankState, adminUser);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl" />

          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-amber-300/40 flex items-center justify-center shadow-lg mb-3 overflow-hidden">
            <img
              src="/arka-logo.jpg"
              alt="لوگو آرکا (ARKA)"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
            راه‌اندازی سیستم صرافی آرکا (ARKA) و دیتابیس ۱۰۰٪ خام
          </h3>
          <p className="text-xs text-amber-100/90 mt-1">
            تنظیم نام مجموعه و تعریف مدیر اصلی سیستم آرکا برای شروع کار واقعی
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 leading-relaxed text-slate-700">
            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              دیتابیس سفید و خام ۱۰۰ درصد:
            </div>
            <p>
              تمامی بانک‌ها، صندوق‌ها، طرف حساب‌ها، فاکتورها و اسناد تستی حذف می‌گردند. تنها کدینگ حسابداری استاندارد و ارزها باقی می‌مانند.
            </p>
          </div>

          {/* Section 1: Company / Exchange Name */}
          <div className="space-y-3 pt-1">
            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
              <Building2 className="w-4 h-4 text-amber-600" />
              ۱. مشخصات صرافی / شرکت:
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">نام صرافی یا مجموعه شما:</label>
              <input
                type="text"
                required
                placeholder="مثال: صرافی پارس، صرافی رضایی یا دفتر ارزی دبی"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition"
              />
            </div>
          </div>

          {/* Section 2: Admin Credentials */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
              <UserCheck className="w-4 h-4 text-teal-600" />
              ۲. تعریف مدیر کل سیستم (حساب کاربری اصلی):
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">نام و نام خانوادگی مدیر:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مدیر صرافی"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">نام کاربری ورود (Username):</label>
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">رمز عبور جدید (Password):</label>
                <input
                  type="password"
                  required
                  placeholder="رمز عبور ورود"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">تکرار رمز عبور:</label>
                <input
                  type="password"
                  required
                  placeholder="تایید رمز عبور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-600/20 transition cursor-pointer"
            >
              <span>تایید و شروع کار واقعی</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
