import React, { useState } from 'react';
import { AccountingState, BotConfig, UserAccount, UserRole, UserPermissions } from '../types/accounting';
import {
  Database,
  Settings,
  ShieldCheck,
  Download,
  Trash2,
  CheckCircle2,
  Server,
  X,
  Users,
  UserPlus,
  Edit2,
  Lock,
  User,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { triggerBackupFileDownload } from '../utils/botAndBackupService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AccountingState;
  currentUser: UserAccount | null;
  onResetToBlankDatabase: () => void;
  onUpdateBotConfig: (patch: Partial<BotConfig>) => void;
  onUpdateUsers: (users: UserAccount[]) => void;
  networkSyncStatus: 'connected' | 'connecting' | 'offline';
  lastSyncTime: string;
}

const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canResetDatabase: true,
    canManageUsers: true,
    canManageCurrencies: true,
    canEditVouchers: true,
    canViewReports: true,
    canIssueInvoices: true,
    canTradeFX: true,
  },
  accountant: {
    canResetDatabase: false,
    canManageUsers: false,
    canManageCurrencies: true,
    canEditVouchers: true,
    canViewReports: true,
    canIssueInvoices: true,
    canTradeFX: true,
  },
  operator: {
    canResetDatabase: false,
    canManageUsers: false,
    canManageCurrencies: false,
    canEditVouchers: true,
    canViewReports: false,
    canIssueInvoices: true,
    canTradeFX: true,
  },
  viewer: {
    canResetDatabase: false,
    canManageUsers: false,
    canManageCurrencies: false,
    canEditVouchers: false,
    canViewReports: true,
    canIssueInvoices: false,
    canTradeFX: false,
  },
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  state,
  currentUser,
  onResetToBlankDatabase,
  onUpdateBotConfig,
  onUpdateUsers,
  networkSyncStatus,
  lastSyncTime,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'reset' | 'bot' | 'server'>('users');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // User Management State
  const [usersList, setUsersList] = useState<UserAccount[]>(state.users || []);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);

  // Form State for User Edit/Add
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('accountant');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS.accountant);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmReset = () => {
    if (currentUser && !currentUser.permissions.canResetDatabase) {
      alert('شما مجوز خام کردن دیتابیس را ندارید.');
      return;
    }
    onResetToBlankDatabase();
    setShowConfirmReset(false);
    setNotice('دیتابیس برنامه با موفقیت صفر و خام گردید. اکنون می‌توانید داده‌های واقعی خود را ثبت نمایید.');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleStartAddUser = () => {
    setEditingUserId(null);
    setIsAddingUser(true);
    setFormFullName('');
    setFormUsername('');
    setFormPassword('123');
    setFormRole('accountant');
    setFormIsActive(true);
    setFormPermissions(DEFAULT_PERMISSIONS.accountant);
    setUserFormError(null);
  };

  const handleStartEditUser = (u: UserAccount) => {
    setIsAddingUser(false);
    setEditingUserId(u.id);
    setFormFullName(u.fullName);
    setFormUsername(u.username);
    setFormPassword(u.passwordHash);
    setFormRole(u.role);
    setFormIsActive(u.isActive);
    setFormPermissions(u.permissions);
    setUserFormError(null);
  };

  const handleRoleChange = (role: UserRole) => {
    setFormRole(role);
    setFormPermissions(DEFAULT_PERMISSIONS[role]);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    if (!formFullName.trim() || !formUsername.trim() || !formPassword.trim()) {
      setUserFormError('لطفاً تمامی فیلدهای الزامی را پر کنید.');
      return;
    }

    // Check duplicate username
    const existing = usersList.find(
      (u) => u.username.toLowerCase() === formUsername.trim().toLowerCase() && u.id !== editingUserId
    );
    if (existing) {
      setUserFormError('این نام کاربری قبلاً استفاده شده است.');
      return;
    }

    let updatedList: UserAccount[];
    if (isAddingUser) {
      const newUser: UserAccount = {
        id: `usr-${Date.now()}`,
        fullName: formFullName.trim(),
        username: formUsername.trim(),
        passwordHash: formPassword.trim(),
        role: formRole,
        isActive: formIsActive,
        permissions: formPermissions,
      };
      updatedList = [...usersList, newUser];
    } else {
      updatedList = usersList.map((u) => {
        if (u.id === editingUserId) {
          return {
            ...u,
            fullName: formFullName.trim(),
            username: formUsername.trim(),
            passwordHash: formPassword.trim(),
            role: formRole,
            isActive: formIsActive,
            permissions: formPermissions,
          };
        }
        return u;
      });
    }

    setUsersList(updatedList);
    onUpdateUsers(updatedList);
    setIsAddingUser(false);
    setEditingUserId(null);
    setNotice(isAddingUser ? 'کاربر جدید با موفقیت اضافه شد.' : 'اطلاعات کاربر با موفقیت به‌روزرسانی شد.');
    setTimeout(() => setNotice(null), 3000);
  };

  const handleDeleteUser = (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (target?.username === 'admin') {
      alert('کاربر اصلی مدیر کل سیستم (admin) قابل حذف نیست.');
      return;
    }
    if (confirm(`آیا از حذف کاربر "${target?.fullName}" اطمینان دارید؟`)) {
      const updatedList = usersList.filter((u) => u.id !== userId);
      setUsersList(updatedList);
      onUpdateUsers(updatedList);
      setNotice('کاربر با موفقیت حذف شد.');
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'مدیر کل سیستم';
      case 'accountant':
        return 'حسابدار ارزی';
      case 'operator':
        return 'اپراتور ثبت';
      case 'viewer':
        return 'بیننده و گزارش‌گیر';
      default:
        return role;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">تنظیمات اپلیکیشن و مدیریت کاربران</h3>
              <p className="text-xs text-slate-500">تعریف کاربران، سطوح دسترسی، خام کردن دیتابیس و پشتیبان‌گیری</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-teal-600" />
            مدیریت کاربران و دسترسی‌ها ({usersList.length})
          </button>

          <button
            onClick={() => setActiveTab('reset')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'reset'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-amber-600" />
            خام کردن دیتابیس (شروع واقعی)
          </button>

          <button
            onClick={() => setActiveTab('bot')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'bot'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            پشتیبان‌گیری و ربات بله/تلگرام
          </button>

          <button
            onClick={() => setActiveTab('server')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'server'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4 text-sky-600" />
            شبکه و سرور
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {notice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* TAB 0: USER & PERMISSION MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Header Action */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">تعریف کاربران و رمز عبور ورود</h4>
                  <p className="text-[11px] text-slate-500">
                    تعیین سطوح دسترسی کاربران صرافی جهت ورود آفلاین یا شبکه محلی
                  </p>
                </div>
                {!isAddingUser && !editingUserId && (
                  <button
                    onClick={handleStartAddUser}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    + افزودن کاربر جدید
                  </button>
                )}
              </div>

              {/* Add / Edit Form */}
              {(isAddingUser || editingUserId) && (
                <form
                  onSubmit={handleSaveUser}
                  className="p-4 rounded-2xl bg-teal-50/50 border-2 border-teal-300 space-y-4 text-xs"
                >
                  <div className="font-extrabold text-teal-900 flex items-center justify-between border-b border-teal-200 pb-2">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-teal-600" />
                      {isAddingUser ? 'تعریف کاربر جدید' : 'ویرایش کاربر و مجوزها'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingUser(false);
                        setEditingUserId(null);
                      }}
                      className="text-slate-500 hover:text-slate-800 font-normal text-[11px]"
                    >
                      انصراف
                    </button>
                  </div>

                  {userFormError && (
                    <div className="p-2.5 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs">
                      {userFormError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">نام و نام خانوادگی:</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: علی رضایی"
                        value={formFullName}
                        onChange={(e) => setFormFullName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">نام کاربری (جهت ورود):</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: ali_rezaei"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">رمز عبور:</label>
                      <input
                        type="text"
                        required
                        placeholder="رمز عبور کاربر"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">نقش کاربر:</label>
                      <select
                        value={formRole}
                        onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold"
                      >
                        <option value="admin">مدیر کل سیستم (دسترسی کامل)</option>
                        <option value="accountant">حسابدار ارزی (ثبت اسناد و فاکتورها)</option>
                        <option value="operator">اپراتور ثبت معاملات</option>
                        <option value="viewer">بیننده (مشاهده گزارش‌ها)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600"
                      />
                      <span>حساب کاربری فعال است و اجازه ورود دارد</span>
                    </label>
                  </div>

                  {/* Permissions Checkboxes */}
                  <div className="space-y-2 pt-2 border-t border-teal-200">
                    <span className="font-extrabold text-teal-950 block">تعیین دقیق مجوزها و دسترسی‌های کاربر:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-teal-200">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={formPermissions.canTradeFX}
                          onChange={(e) =>
                            setFormPermissions({ ...formPermissions, canTradeFX: e.target.checked })
                          }
                        />
                        <span>انجام معاملات خرید و فروش ارز (صرافی)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={formPermissions.canIssueInvoices}
                          onChange={(e) =>
                            setFormPermissions({ ...formPermissions, canIssueInvoices: e.target.checked })
                          }
                        />
                        <span>صدور و تسویه فاکتورهای ارزی/کالایی</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={formPermissions.canEditVouchers}
                          onChange={(e) =>
                            setFormPermissions({ ...formPermissions, canEditVouchers: e.target.checked })
                          }
                        />
                        <span>ثبت و ویرایش اسناد مالی و دریافت/پرداخت</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={formPermissions.canViewReports}
                          onChange={(e) =>
                            setFormPermissions({ ...formPermissions, canViewReports: e.target.checked })
                          }
                        />
                        <span>مشاهده صورتحساب اشخاص و گزارش سود/زیان</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={formPermissions.canManageCurrencies}
                          onChange={(e) =>
                            setFormPermissions({ ...formPermissions, canManageCurrencies: e.target.checked })
                          }
                        />
                        <span>افزودن ارز جدید و ویرایش نرخ‌ها</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={formPermissions.canManageUsers}
                          onChange={(e) =>
                            setFormPermissions({ ...formPermissions, canManageUsers: e.target.checked })
                          }
                        />
                        <span>مدیریت و تعریف سایر کاربران</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-extrabold text-amber-800 col-span-1 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={formPermissions.canResetDatabase}
                          onChange={(e) =>
                            setFormPermissions({ ...formPermissions, canResetDatabase: e.target.checked })
                          }
                        />
                        <span>خام کردن دیتابیس (صفر کردن اسناد تستی برای شروع کار واقعی)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingUser(false);
                        setEditingUserId(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-extrabold transition shadow-xs"
                    >
                      ذخیره اطلاعات کاربر
                    </button>
                  </div>
                </form>
              )}

              {/* Users List */}
              <div className="space-y-2">
                {usersList.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          u.role === 'admin'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : u.role === 'accountant'
                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.fullName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs">{u.fullName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {getRoleLabel(u.role)}
                          </span>
                          {!u.isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-100 text-rose-700">
                              غیرفعال
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num flex items-center gap-3 mt-0.5">
                          <span>نام کاربری: <strong>{u.username}</strong></span>
                          <span>رمز: <strong className="font-mono">***</strong></span>
                          {u.lastLogin && <span>آخرین ورود: {u.lastLogin}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <button
                        onClick={() => handleStartEditUser(u)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        ویرایش / رمز
                      </button>
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: Reset to Blank Database */}
          {activeTab === 'reset' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2 leading-relaxed">
                <div className="font-extrabold flex items-center gap-2 text-amber-900">
                  <Database className="w-4 h-4 text-amber-600" />
                  راهنمای خام کردن دیتابیس برای شروع کار واقعی:
                </div>
                <p>
                  نرم‌افزار ترازبان جهت آشنایی شما با اسناد نمونه و داده‌های آزمایش بارگذاری شده بود. اگر قصد دارید ثبت اسناد واقعی شرکت یا صرافی خود را آغاز کنید، می‌توانید دیتابیس را به حالت <strong>کاملاً خام (سفید)</strong> تغییر دهید.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium pt-1">
                  <li>تمام اسناد حسابداری، فاکتورهای آزمایشی و طرف حساب‌های تستی پاک خواهند شد.</li>
                  <li>ساختار کدهای استاندارد معین، لیست ارزها، کاربران و بانک‌های اصلی حفظ می‌گردند.</li>
                  <li>این پاک‌سازی روی سرور مشترک لینوکس و تمامی گوشی‌ها و کامپیوترهای متصل همگام خواهد شد.</li>
                </ul>
              </div>

              {!showConfirmReset ? (
                <div className="pt-2">
                  <button
                    onClick={() => setShowConfirmReset(true)}
                    className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-amber-600/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    پاک‌سازی و صفر کردن کامل دیتابیس (شروع واقعی)
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 space-y-3 text-xs">
                  <div className="font-extrabold text-rose-900 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    تایید نهایی: آیا از حذف کامل اسناد تستی و صفر کردن دیتابیس اطمینان دارید؟
                  </div>
                  <p className="text-slate-700">
                    این عملیات غیرقابل بازگشت است. در صورت تمایل قبل از کلیک می‌توانید یک فایل بکاپ دانلود کنید.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowConfirmReset(false)}
                      className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      onClick={handleConfirmReset}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold transition cursor-pointer shadow-xs"
                    >
                      بله، دیتابیس را خام کن
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Bot & Backup */}
          {activeTab === 'bot' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="font-bold text-slate-900">دانلود مستقیم آخرین بکاپ کامل</div>
                  <div className="text-[11px] text-slate-500">ذخیره تمام اطلاعات در یک فایل JSON روی دستگاه شما</div>
                </div>
                <button
                  onClick={() => triggerBackupFileDownload(state)}
                  className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  دانلود فایل بکاپ
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div className="font-bold text-slate-900">تنظیمات بکاپ خودکار ساعتی به پیام‌رسان بله / تلگرام:</div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-950">
                    <span>۱. بازوی بله (Bale Bot)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.botConfig.baleEnabled}
                        onChange={(e) => onUpdateBotConfig({ baleEnabled: e.target.checked })}
                      />
                      <span>فعال</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="توکن ربات بله"
                    value={state.botConfig.baleBotToken}
                    onChange={(e) => onUpdateBotConfig({ baleBotToken: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-num"
                  />
                  <input
                    type="text"
                    placeholder="شناسه چت بله (Chat ID)"
                    value={state.botConfig.baleDefaultChatId}
                    onChange={(e) => onUpdateBotConfig({ baleDefaultChatId: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-num"
                  />
                </div>

                <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between font-bold text-sky-950">
                    <span>۲. ربات تلگرام (Telegram Bot)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.botConfig.telegramEnabled}
                        onChange={(e) => onUpdateBotConfig({ telegramEnabled: e.target.checked })}
                      />
                      <span>فعال</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="توکن ربات تلگرام"
                    value={state.botConfig.telegramBotToken}
                    onChange={(e) => onUpdateBotConfig({ telegramBotToken: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-num"
                  />
                  <input
                    type="text"
                    placeholder="شناسه چت تلگرام (Chat ID)"
                    value={state.botConfig.telegramDefaultChatId}
                    onChange={(e) => onUpdateBotConfig({ telegramDefaultChatId: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-num"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Server & Network */}
          {activeTab === 'server' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">وضعیت اتصال به سرور مرکزی لینوکس:</span>
                  <span
                    className={`font-extrabold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                      networkSyncStatus === 'connected'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : networkSyncStatus === 'connecting'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>متصل به سرور مرکزی (سینک آنی شبکه)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 font-mono-num pt-1 border-t border-slate-200">
                  <span>آخرین همگام‌سازی دیتابیس مشترک:</span>
                  <span className="font-bold text-slate-900">{lastSyncTime || 'هم‌اکنون (لحظاتی پیش)'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-slate-800 space-y-2 leading-relaxed">
                <div className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  همگام‌سازی کامل شبکه محلی صرافی (بدون نیاز به اینترنت):
                </div>
                <p>
                  تمامی سیستم‌ها و گوشی‌های متصل به سرور مرکزی لینوکس، اسناد، فاکتورها، حساب اشخاص و کاربران را به صورت <strong>همزمان روی یک دیتابیس مشترک</strong> ثبت و حذف می‌نمایند.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 font-semibold pt-1">
                  <li>ثبت یا حذف هر سند توسط هر کاربر، بلافاصله روی تمام کلاینت‌های شبکه لینوکس اعمال می‌شود.</li>
                  <li>عدم وابستگی به اینترنت بین‌الملل به معنی کارکرد کامل روی شبکه داخلی (اینترانت صرافی) است.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono-num">
            ترازبان نسخه ارزی ۲.۴
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-xs transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
