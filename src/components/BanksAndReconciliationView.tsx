import React, { useState, useMemo } from 'react';
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

  // فرم تعریف بانک یا صندوق جدید
  const [newBankKind, setNewBankKind] = useState<'bank' | 'cash_box'>('bank');
  const [newBankName, setNewBankName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newIban, setNewIban] = useState('');
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>('IRR');
  const [newInitBalance, setNewInitBalance] = useState<number>(0);

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

    const newBankObj: BankAccount = {
      id: `bnk-${Date.now()}`,
      code: `${newBankKind === 'cash_box' ? 'C' : 'B'}-${105 + banks.length}`,
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
    <div className="space-y-6">
      {/* کارت‌های موجودی لحظه‌ای همه بانک‌ها و صندوق‌ها */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-teal-400" />
              موجودی لحظه‌ای بانک‌ها و صندوق‌های نقدی / ارزی
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              روی هر بانک یا صندوق کلیک کنید تا ریز واریزها و برداشت‌های اتوماتیک آن را مشاهده نمایید.
            </p>
          </div>
        </div>

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
                    ? 'bg-teal-500/15 border-teal-500 shadow-lg shadow-teal-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-slate-900 text-teal-300 border border-slate-700 flex items-center gap-1">
                      {b.kind === 'cash_box' ? (
                        <>
                          <Wallet className="w-3 h-3 text-amber-400" />
                          صندوق
                        </>
                      ) : (
                        <>
                          <Landmark className="w-3 h-3 text-teal-400" />
                          بانک
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono-num px-2 py-0.5 rounded bg-slate-900 text-slate-300">
                        {b.currency}
                      </span>
                      {onDeleteBank && banks.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBank(b.id);
                          }}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                          title="حذف بانک/صندوق"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="font-bold text-white text-sm">{b.bankName}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {b.branchName} {b.accountNumber !== '-' ? `| شماره: ${b.accountNumber}` : ''}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400">موجودی فعلی:</span>
                    <span className="text-base font-bold text-emerald-400 font-mono-num">
                      {formatNumber(
                        b.currency === 'IRR' ? stat.balanceIRR : stat.balanceForeign
                      )}{' '}
                      {b.currency === 'IRR' ? 'ریال' : b.currency}
                    </span>
                  </div>
                  {b.currency !== 'IRR' && (
                    <div className="flex items-center justify-between text-[11px] text-amber-300 mt-1 font-mono-num">
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
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-teal-400" />
                ریز تراکنش‌ها و گردش حساب:{' '}
                <span className="text-teal-400">{selectedBank.bankName}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تمامی واریزها و برداشت‌های ثبت‌شده از طریق فاکتورها، معاملات ارز و امور مالی اتوماتیک
              </p>
            </div>

            {reconciliation && (
              <div className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 font-mono-num">
                مانده نهایی دفتر بانک:{' '}
                <strong className="text-emerald-400">
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

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">شماره سند</th>
                  <th className="p-3">تاریخ</th>
                  <th className="p-3">شرح تراکنش</th>
                  <th className="p-3">ورودی / واریز (+)</th>
                  <th className="p-3">خروجی / برداشت (-)</th>
                  <th className="p-3">معادل ریالی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {selectedBankTransactions.map((tx) => {
                  const isDeposit = tx.debitIRR > 0 || tx.debitForeign > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono-num text-teal-400 font-bold">
                        #{tx.voucherNumber}
                      </td>
                      <td className="p-3 font-mono-num text-slate-300">{tx.date}</td>
                      <td className="p-3 text-white">{tx.description}</td>
                      <td className="p-3 font-mono-num font-bold text-emerald-400">
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
                      <td className="p-3 font-mono-num font-bold text-rose-400">
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
                      <td className="p-3 font-mono-num text-slate-300">
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
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-teal-400" />
            افزودن بانک یا صندوق جدید (ریالی یا ارزی)
          </h3>

          <form onSubmit={handleCreateBank} className="space-y-4">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setNewBankKind('bank')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  newBankKind === 'bank'
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
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
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4" />
                صندوق نقدی / گاوصندوق ارزی
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {newBankKind === 'bank'
                    ? 'نام بانک (مثلاً بانک پاسارگاد)'
                    : 'نام صندوق (مثلاً صندوق یورو)'}
                </label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="نام را وارد کنید..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">نوع ارز حساب/صندوق</label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value as CurrencyCode)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  موجودی اولیه هنگام تعریف ({newCurrency})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newInitBalance ? formatNumber(newInitBalance) : ''}
                  onChange={(e) => setNewInitBalance(parseFormattedNumber(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  شماره حساب / کارت (اختیاری)
                </label>
                <input
                  type="text"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  placeholder="اختیاری"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono-num"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              ثبت بانک / صندوق جدید و صدور اتوماتیک سند موجودی اولیه
            </button>
          </form>
        </div>

        {/* مدیریت نرخ روز ارزها */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            تنظیم نرخ پیش‌فرض ارزها (به ریال)
          </h3>

          <div className="space-y-2.5">
            {currencies
              .filter((c) => !c.isBase)
              .map((c) => (
                <div
                  key={c.code}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-white text-xs">{c.name}</span>
                    <span className="text-[11px] text-teal-400 font-mono-num mr-2">
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
                      className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-num"
                    />
                    <span className="text-xs text-slate-400">ریال</span>
                  </div>
                </div>
              ))}
          </div>

          <form
            onSubmit={handleCreateCurrency}
            className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
          >
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">کد ارز (مثل TRY)</label>
              <input
                type="text"
                value={newCurrCode}
                onChange={(e) => setNewCurrCode(e.target.value)}
                placeholder="TRY"
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">نام ارز</label>
              <input
                type="text"
                value={newCurrName}
                onChange={(e) => setNewCurrName(e.target.value)}
                placeholder="لیر ترکیه"
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">نرخ به ریال</label>
              <input
                type="text"
                inputMode="numeric"
                value={newCurrRate ? formatNumber(newCurrRate) : ''}
                onChange={(e) => setNewCurrRate(parseFormattedNumber(e.target.value))}
                placeholder="27,000"
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono-num"
              />
            </div>
            <button
              type="submit"
              className="py-1.5 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              + افزودن ارز
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
