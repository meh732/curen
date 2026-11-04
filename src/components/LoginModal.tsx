import React, { useState } from 'react';
import { UserAccount } from '../types/accounting';
import { LogIn, ShieldCheck, Lock, User, KeyRound, AlertCircle, Coins } from 'lucide-react';

interface LoginModalProps {
  users: UserAccount[];
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ users, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      lastLogin: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR'),
    };
    onLoginSuccess(updatedUser);
  };

  const handleQuickLogin = (user: UserAccount) => {
    setUsername(user.username);
    setPassword(user.passwordHash);
    const updatedUser: UserAccount = {
      ...user,
      lastLogin: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR'),
    };
    onLoginSuccess(updatedUser);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/30 mb-4 relative z-10">
            <Coins className="w-9 h-9 text-white" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight relative z-10">
            ورود به سیستم ترازبان ارزی
          </h2>
          <p className="text-xs text-teal-200/80 mt-1.5 relative z-10">
            نرم‌افزار صرافی، حسابداری ارزی و مدیریت شبکه محلی
          </p>
        </div>

        {/* Body Form */}
        <div className="p-6 sm:p-8 space-y-6">
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
                  placeholder="مثال: admin یا hesabdar"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                رمز عبور:
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="رمز عبور خود را وارد کنید"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              ورود به برنامه
            </button>
          </form>

          {/* Quick Login Chips for Ease of Use */}
          {users.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-500 text-center flex items-center justify-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                ورود سریع کاربران تعریف شده (جهت تست و شبکه):
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleQuickLogin(u)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{u.fullName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({u.username})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            اتصال امن آفلاین شبکه محلی و اینترانت صرافی
          </div>
        </div>
      </div>
    </div>
  );
};
