import React, { useState, useRef } from 'react';
import arkaLogo from '../assets/arka-logo.jpg';
import { UserAccount } from '../types/accounting';
import { LogIn, ShieldCheck, Lock, User, KeyRound, AlertCircle, Coins, Eye, EyeOff } from 'lucide-react';

interface LoginModalProps {
  users: UserAccount[];
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ users, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetUser = users.find(
      (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase()
    );

    if (!targetUser) {
      setError('نام کاربری وارد شده در سیستم یافت نشد.');
      return;
    }

    if (!targetUser.isActive) {
      setError('حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.');
      return;
    }

    if (targetUser.passwordHash !== password) {
      setError('رمز عبور وارد شده نادرست است.');
      return;
    }

    // Login success
    const updatedUser: UserAccount = {
      ...targetUser,
      lastLogin:
        new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR'),
    };
    onLoginSuccess(updatedUser);
  };

  // با زدن روی نام کاربر فقط نام کاربری انتخاب می‌شود و کاربر حتماً باید رمز عبور را دستی وارد کند
  const handleSelectUser = (user: UserAccount) => {
    setUsername(user.username);
    setPassword('');
    setError(null);
    // فوکوس روی فیلد رمز عبور
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-teal-400/40 flex items-center justify-center shadow-lg shadow-teal-500/30 mb-4 relative z-10 overflow-hidden">
            <img
              src={arkaLogo}
              alt="لوگو آرکا (ARKA)"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight relative z-10">
            ورود به سیستم جامع صرافی و حسابداری آرکا (ARKA)
          </h2>
          <p className="text-xs text-teal-200/80 mt-1.5 relative z-10">
            نرم‌افزار تخصصی صرافی، حسابداری دوارزی و مدیریت شبکه محلی آرکا
          </p>
        </div>

        {/* Body Form */}
        <div className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                نام کاربری:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="نام کاربری (مثال: admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                رمز عبور کاربر:
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="رمز عبور خود را وارد کنید"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              ورود با احراز هویت
            </button>
          </form>

          {/* انتخاب سریع کاربر برای پر کردن نام کاربری (رمز عبور هرگز خودکار پر نمی‌شود) */}
          {users.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-500 text-center flex items-center justify-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                <span>انتخاب کاربر (ورود رمز عبور الزامی است):</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {users.map((u) => {
                  const isSelected = username.trim().toLowerCase() === u.username.trim().toLowerCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-xs ring-1 ring-teal-500'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-teal-600' : 'bg-slate-400'}`} />
                      <span>{u.fullName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({u.username})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            امنیت ورود با اعتبارسنجی رمز عبور و دسترسی اختصاصی
          </div>
        </div>
      </div>
    </div>
  );
};
