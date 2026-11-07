import React, { useState, useMemo, useEffect } from 'react';
import {
  BankAccount,
  BankStatementEntry,
  JournalVoucher,
  Currency,
  CurrencyCode,
} from '../types/accounting';
import {
  reconcileBankTransactions,
  formatNumber,
  parseFormattedNumber,
} from '../utils/accountingEngine';
import {
  Landmark,
  Wallet,
  CheckCircle2,
  Plus,
  Trash2,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';

interface BanksAndReconciliationViewProps {
  banks: BankAccount[];
  bankStatements: BankStatementEntry[];
  vouchers: JournalVoucher[];
  currencies: Currency[];
  onAddBankStatement: (entry: BankStatementEntry) => void;
  onAddBank?: (bank: BankAccount) => void;
  onDeleteBank?: (id: string) => void;
  onUpdateCurrencies?: (currencies: Currency[]) => void;
}

export const BanksAndReconciliationView: React.FC<BanksAndReconciliationViewProps> = ({
  banks,
  bankStatements,
  vouchers,
  currencies,
  onAddBank,
  onDeleteBank,
  onUpdateCurrencies,
}) => {
  const [selectedBankId, setSelectedBankId] = useState<string>(banks[0]?.id || '');

  useEffect(() => {
    if (banks.length > 0 && (!selectedBankId || !banks.some((b) => b.id === selectedBankId))) {
      setSelectedBankId(banks[0].id);
    }
  }, [banks, selectedBankId]);

  // فرم تعریف بانک یا صندوق جدید
  const [newBankKind, setNewBankKind] = useState<'bank' | 'cash_box'>('bank');
  const [newBankName, setNewBankName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newIban, setNewIban] = useState('');
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>('IRR');
  const [newInitBalance, setNewInitBalance] = useState<number>(0);
  const [showAddBankSection, setShowAddBankSection] = useState(false);

  // مدیریت ارزها
  const [newCurrCode, setNewCurrCode] = useState('');
  const [newCurrName, setNewCurrName] = useState('');
  const [newCurrSymbol, setNewCurrSymbol] = useState('');
  const [newCurrRate, setNewCurrRate] = useState<number>(0);

  // محاسبه موجودی واقعی هر بانک یا صندوق از روی اسناد حسابداری
  const bankBalancesMap = useMemo(() => {
    const map: Record<
      string,
      { balanceForeign: number; balanceIRR: number; txCount: number }
    > = {};

    banks.forEach((b) => {
      const rate =
        b.currency === 'IRR'
          ? 1
          : currencies.find((c) => c.code === b.currency)?.defaultRateToIRR || 1;
      let balForeign = b.initialBalanceForeign || 0;
      let balIRR = b.initialBalanceIRR || 0;
      let count = 0;

      vouchers.forEach((v) => {
        v.lines.forEach((ln) => {
          if (ln.bankId === b.id) {
            count++;
            if (b.currency === 'IRR') {
              balForeign += ln.debitIRR - ln.creditIRR;
              balIRR += ln.debitIRR - ln.creditIRR;
            } else {
              balForeign += (ln.debitForeign || 0) - (ln.creditForeign || 0);
              balIRR += ln.debitIRR - ln.creditIRR;
            }
          }
        });
      });

      if (b.currency !== 'IRR') {
        balIRR = Math.round(balForeign * rate);
      }

      map[b.id] = { balanceForeign: balForeign, balanceIRR: balIRR, txCount: count };
    });

    return map;
  }, [banks, vouchers, currencies]);

  const selectedBank = banks.find((b) => b.id === selectedBankId) || banks[0];

  // گردش حساب بانک یا صندوق انتخاب‌شده
  const selectedBankTransactions = useMemo(() => {
    if (!selectedBank) return [];
    const list: {
      id: string;
      voucherNumber: number;
      date: string;
      description: string;
      debitForeign: number;
      creditForeign: number;
      debitIRR: number;
      creditIRR: number;
      currency: CurrencyCode;
    }[] = [];

    vouchers.forEach((v) => {
      v.lines.forEach((ln) => {
        if (ln.bankId === selectedBank.id) {
          list.push({
            id: ln.id,
            voucherNumber: v.voucherNumber,
            date: v.date,
            description: ln.description || v.description,
            debitForeign: ln.debitForeign,
            creditForeign: ln.creditForeign,
            debitIRR: ln.debitIRR,
            creditIRR: ln.creditIRR,
            currency: ln.currency,
          });
        }
      });
    });
    return list;
  }, [selectedBank, vouchers]);

  const reconciliation = useMemo(() => {
    if (!selectedBank) return null;
    return reconcileBankTransactions(
      selectedBank.id,
      selectedBank.initialBalanceForeign,
      selectedBank.initialBalanceIRR,
      vouchers,
      bankStatements
    );
  }, [selectedBank, bankStatements, vouchers]);

  const handleCreateBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !onAddBank) return;
    const rate =
      newCurrency === 'IRR'
        ? 1
        : currencies.find((c) => c.code === newCurrency)?.defaultRateToIRR || 1;
    const moeinCode =
      newCurrency !== 'IRR' ? '1103' : newBankKind === 'cash_box' ? '1101' : '1102';

    const nextBankCodeNum =
      Math.max(100, ...banks.map((b) => parseInt(b.code.replace(/\D/g, ''), 10) || 100)) + 1;
    const newBankObj: BankAccount = {
      id: `bnk-${Date.now()}`,
      code: `${newBankKind === 'cash_box' ? 'C' : 'B'}-${nextBankCodeNum}`,
      bankName: newBankName.trim(),
      branchName:
        newBranchName.trim() ||
        (newBankKind === 'cash_box' ? 'صندوق نقدی / خزانه' : 'شعبه مرکزی'),
      accountNumber: newAccountNumber.trim() || '-',
      shebaOrIban: newIban.trim() || '-',
      currency: newCurrency,
      kind: newBankKind,
      moeinCode,
      initialBalanceForeign: newInitBalance,
      initialBalanceIRR: Math.round(newInitBalance * rate),
    };
    onAddBank(newBankObj);
    setSelectedBankId(newBankObj.id);
    setNewBankName('');
    setNewBranchName('');
    setNewAccountNumber('');
    setNewIban('');
    setNewInitBalance(0);
    setShowAddBankSection(false);
  };

  const handleRateChange = (code: CurrencyCode, newRate: number) => {
    if (!onUpdateCurrencies) return;
    const updated = currencies.map((c) =>
      c.code === code
        ? {
            ...c,
            defaultRateToIRR: newRate,
            updatedAt: '1404/08/12',
          }
        : c
    );
    onUpdateCurrencies(updated);
  };

  const handleCreateCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurrCode.trim() || !newCurrName.trim() || newCurrRate <= 0 || !onUpdateCurrencies)
      return;
    const codeUpper = newCurrCode.trim().toUpperCase();
    if (currencies.some((c) => c.code === codeUpper)) return;
    const newCurr: Currency = {
      code: codeUpper,
      name: newCurrName.trim(),
      symbol: newCurrSymbol.trim() || codeUpper,
      isBase: false,
      defaultRateToIRR: newCurrRate,
      updatedAt: '1404/08/12',
    };
    onUpdateCurrencies([...currencies, newCurr]);
    setNewCurrCode('');
    setNewCurrName('');
    setNewCurrSymbol('');
    setNewCurrRate(0);
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* کارت‌های موجودی لحظه‌ای همه بانک‌ها و صندوق‌ها */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-teal-600" />
              موجودی لحظه‌ای بانک‌ها و صندوق‌های نقدی / ارزی
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              روی هر بانک یا صندوق کلیک کنید تا ریز واریزها و برداشت‌های اتوماتیک آن را مشاهده نمایید.
            </p>
          </div>

          {onAddBank && (
            <button
              type="button"
              onClick={() => setShowAddBankSection(!showAddBankSection)}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddBankSection ? 'بستن فرم تعریف' : '+ تعریف بانک یا صندوق جدید (ریالی و ارزی)'}</span>
            </button>
          )}
        </div>

        {/* فرم بازشونده سریع برای تعریف حساب بانکی یا صندوق جدید */}
        {showAddBankSection && (
          <div className="mb-6 p-4 sm:p-5 bg-teal-50/70 border-2 border-teal-400 rounded-2xl animate-fadeIn shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-teal-950 flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-700" />
                تعریف بانک یا صندوق جدید (ریالی یا ارزی)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBankSection(false)}
                className="text-xs text-teal-800 hover:underline font-bold cursor-pointer"
              >
                انصراف
              </button>
            </div>

            <form onSubmit={handleCreateBank} className="space-y-4 bg-white p-4 rounded-xl border border-teal-200">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 max-w-xs">
                <button
                  type="button"
                  onClick={() => setNewBankKind('bank')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    newBankKind === 'bank'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  حساب بانکی
                </button>
                <button
                  type="button"
                  onClick={() => setNewBankKind('cash_box')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    newBankKind === 'cash_box'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  صندوق / گاوصندوق
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {newBankKind === 'bank' ? 'نام بانک (مثلاً بانک ملت)' : 'نام صندوق (مثلاً گاوصندوق دلار)'}
                  </label>
                  <input
                    type="text"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    placeholder="نام را وارد کنید..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-teal-600 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع ارز حساب/صندوق</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as CurrencyCode)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-teal-600 outline-none"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {newBankKind === 'bank' ? 'شماره حساب / کارت' : 'نام مسئول / محل صندوق'}
                  </label>
                  <input
                    type="text"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    placeholder="مثلاً: 6037-9918-..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-teal-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    موجودی اولیه ({newCurrency})
                  </label>
                  <input
                    type="text"
                    value={newInitBalance === 0 ? '' : formatNumber(newInitBalance)}
                    onChange={(e) => setNewInitBalance(parseFormattedNumber(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-teal-600 outline-none font-mono-num font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!newBankName.trim()}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  ثبت و فعال‌سازی این {newBankKind === 'bank' ? 'بانک' : 'صندوق'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {banks.map((b) => {
            const stat = bankBalancesMap[b.id] || {
              balanceForeign: 0,
              balanceIRR: 0,
              txCount: 0,
            };
            const isSelected = selectedBank?.id === b.id;

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBankId(b.id)}
                className={`cursor-pointer rounded-xl p-4 border transition relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-teal-50/90 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-white text-teal-800 border border-teal-200 flex items-center gap-1 shadow-xs">
                      {b.kind === 'cash_box' ? (
                        <>
                          <Wallet className="w-3 h-3 text-amber-600" />
                          صندوق
                        </>
                      ) : (
                        <>
                          <Landmark className="w-3 h-3 text-teal-600" />
                          بانک
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono-num font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {b.currency}
                      </span>
                      {onDeleteBank && banks.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `آیا از حذف حساب/صندوق «${b.bankName}» و خارج کردن آن از لیست اطمینان دارید؟`
                              )
                            ) {
                              onDeleteBank(b.id);
                            }
                          }}
                          className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-100 cursor-pointer"
                          title="حذف بانک/صندوق"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-sm">{b.bankName}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {b.branchName} {b.accountNumber !== '-' ? `| شماره: ${b.accountNumber}` : ''}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">موجودی فعلی:</span>
                    <span className="text-base font-extrabold text-emerald-700 font-mono-num">
                      {formatNumber(
                        b.currency === 'IRR' ? stat.balanceIRR : stat.balanceForeign
                      )}{' '}
                      {b.currency === 'IRR' ? 'ریال' : b.currency}
                    </span>
                  </div>
                  {b.currency !== 'IRR' && (
                    <div className="flex items-center justify-between text-[11px] text-amber-800 mt-1 font-mono-num font-semibold">
                      <span>ارزش ریالی:</span>
                      <span>{formatNumber(stat.balanceIRR)} ریال</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ریز گردش حساب بانک یا صندوق انتخاب‌شده */}
      {selectedBank && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-teal-600" />
                ریز تراکنش‌ها و گردش حساب:{' '}
                <span className="text-teal-700">{selectedBank.bankName}</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                تمامی واریزها و برداشت‌های ثبت‌شده از طریق فاکتورها، معاملات ارز و امور مالی اتوماتیک
              </p>
            </div>

            {reconciliation && (
              <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 font-mono-num">
                مانده نهایی دفتر بانک:{' '}
                <strong className="text-emerald-700 font-bold">
                  {formatNumber(
                    selectedBank.currency === 'IRR'
                      ? bankBalancesMap[selectedBank.id]?.balanceIRR || 0
                      : bankBalancesMap[selectedBank.id]?.balanceForeign || 0
                  )}{' '}
                  {selectedBank.currency === 'IRR' ? 'ریال' : selectedBank.currency}
                </strong>
              </div>
            )}
          </div>

          {/* کارت‌های موبایل برای تراکنش‌های بانک (در گوشی صف‌آرایی عمودی می‌شود) */}
          <div className="sm:hidden space-y-3">
            {selectedBankTransactions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                هیچ تراکنشی برای این بانک ثبت نشده است.
              </div>
            ) : (
              selectedBankTransactions.map((tx) => {
                const isDeposit = tx.debitIRR > 0 || tx.debitForeign > 0;
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-num text-teal-700 font-bold">
                        سند #{tx.voucherNumber}
                      </span>
                      <span className="font-mono-num text-slate-500 text-[11px]">
                        {tx.date}
                      </span>
                    </div>

                    <div className="font-medium text-slate-900 leading-snug">
                      {tx.description}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono-num">
                      <span className="text-slate-500 text-[11px]">نوع تراکنش:</span>
                      {isDeposit ? (
                        <span className="font-extrabold text-emerald-700 flex items-center gap-1">
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          واریز:{' '}
                          {formatNumber(
                            selectedBank.currency === 'IRR' ? tx.debitIRR : tx.debitForeign
                          )}{' '}
                          {selectedBank.currency}
                        </span>
                      ) : (
                        <span className="font-extrabold text-rose-700 flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          برداشت:{' '}
                          {formatNumber(
                            selectedBank.currency === 'IRR' ? tx.creditIRR : tx.creditForeign
                          )}{' '}
                          {selectedBank.currency}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono-num">
                      <span>معادل ریالی:</span>
                      <span>{formatNumber(tx.debitIRR || tx.creditIRR)} ریال</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* جدول تراکنش‌ها در دسکتاپ و تبلت */}
          <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">شماره سند</th>
                  <th className="p-3">تاریخ</th>
                  <th className="p-3">شرح تراکنش</th>
                  <th className="p-3">ورودی / واریز (+)</th>
                  <th className="p-3">خروجی / برداشت (-)</th>
                  <th className="p-3">معادل ریالی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedBankTransactions.map((tx) => {
                  const isDeposit = tx.debitIRR > 0 || tx.debitForeign > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono-num text-teal-700 font-bold">
                        #{tx.voucherNumber}
                      </td>
                      <td className="p-3 font-mono-num text-slate-600">{tx.date}</td>
                      <td className="p-3 text-slate-900 font-medium">{tx.description}</td>
                      <td className="p-3 font-mono-num font-bold text-emerald-700">
                        {isDeposit ? (
                          <span className="flex items-center gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            {formatNumber(
                              selectedBank.currency === 'IRR' ? tx.debitIRR : tx.debitForeign
                            )}{' '}
                            {selectedBank.currency}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 font-mono-num font-bold text-rose-700">
                        {!isDeposit ? (
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            {formatNumber(
                              selectedBank.currency === 'IRR' ? tx.creditIRR : tx.creditForeign
                            )}{' '}
                            {selectedBank.currency}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 font-mono-num text-slate-700">
                        {formatNumber(tx.debitIRR || tx.creditIRR)} ریال
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تعریف بانک یا صندوق جدید + نرخ روز ارزها */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* فرم افزودن بانک یا صندوق جدید */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-teal-600" />
            افزودن بانک یا صندوق جدید (ریالی یا ارزی)
          </h3>

          <form onSubmit={handleCreateBank} className="space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setNewBankKind('bank')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  newBankKind === 'bank'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Landmark className="w-4 h-4" />
                حساب بانکی
              </button>
              <button
                type="button"
                onClick={() => setNewBankKind('cash_box')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  newBankKind === 'cash_box'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-4 h-4" />
                صندوق نقدی / گاوصندوق ارزی
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {newBankKind === 'bank'
                    ? 'نام بانک (مثلاً بانک پاسارگاد)'
                    : 'نام صندوق (مثلاً صندوق یورو)'}
                </label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="نام را وارد کنید..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">نوع ارز حساب/صندوق</label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value as CurrencyCode)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  موجودی اولیه هنگام تعریف ({newCurrency})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newInitBalance ? formatNumber(newInitBalance) : ''}
                  onChange={(e) => setNewInitBalance(parseFormattedNumber(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  شماره حساب / کارت (اختیاری)
                </label>
                <input
                  type="text"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  placeholder="اختیاری"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              ثبت بانک / صندوق جدید و صدور اتوماتیک سند موجودی اولیه
            </button>
          </form>
        </div>

        {/* مدیریت نرخ روز ارزها */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-600" />
            تنظیم نرخ پیش‌فرض ارزها (به ریال)
          </h3>

          <div className="space-y-2.5">
            {currencies
              .filter((c) => !c.isBase)
              .map((c) => (
                <div
                  key={c.code}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-slate-900 text-xs">{c.name}</span>
                    <span className="text-[11px] text-teal-700 font-bold font-mono-num mr-2">
                      ({c.code})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(c.defaultRateToIRR)}
                      onChange={(e) =>
                        handleRateChange(c.code, parseFormattedNumber(e.target.value))
                      }
                      className="w-36 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                    <span className="text-xs text-slate-600">ریال</span>
                  </div>
                </div>
              ))}
          </div>

          <form
            onSubmit={handleCreateCurrency}
            className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
          >
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">کد ارز (مثل TRY)</label>
              <input
                type="text"
                value={newCurrCode}
                onChange={(e) => setNewCurrCode(e.target.value)}
                placeholder="TRY"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">نام ارز</label>
              <input
                type="text"
                value={newCurrName}
                onChange={(e) => setNewCurrName(e.target.value)}
                placeholder="لیر ترکیه"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">نرخ به ریال</label>
              <input
                type="text"
                inputMode="numeric"
                value={newCurrRate ? formatNumber(newCurrRate) : ''}
                onChange={(e) => setNewCurrRate(parseFormattedNumber(e.target.value))}
                placeholder="27,000"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 font-mono-num focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <button
              type="submit"
              className="py-1.5 px-3 rounded bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs cursor-pointer shadow-xs"
            >
              + افزودن ارز
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
