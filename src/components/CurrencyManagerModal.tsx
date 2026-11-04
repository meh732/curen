import React, { useState } from 'react';
import { Currency, CurrencyCode } from '../types/accounting';
import { formatNumber, parseFormattedNumber } from '../utils/accountingEngine';
import { Coins, Plus, Trash2, CheckCircle2, Edit3, X } from 'lucide-react';

interface CurrencyManagerModalProps {
  currencies: Currency[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateCurrencies: (updated: Currency[]) => void;
}

export const CurrencyManagerModal: React.FC<CurrencyManagerModalProps> = ({
  currencies,
  isOpen,
  onClose,
  onUpdateCurrencies,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newRate, setNewRate] = useState<number>(50000);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<number>(0);

  if (!isOpen) return null;

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase() as CurrencyCode;
    if (!code || !newName.trim() || newRate <= 0) return;

    if (currencies.some((c) => c.code === code)) {
      alert('این کد ارز قبلاً تعریف شده است.');
      return;
    }

    const created: Currency = {
      code,
      name: newName.trim(),
      symbol: newSymbol.trim() || code,
      defaultRateToIRR: newRate,
      updatedAt: '1404/08/12',
    };

    onUpdateCurrencies([...currencies, created]);
    setNewCode('');
    setNewName('');
    setNewSymbol('');
    setNewRate(50000);
    setShowAddForm(false);
  };

  const handleSaveEditRate = (code: string) => {
    if (editingRate <= 0) return;
    const updated = currencies.map((c) =>
      c.code === code ? { ...c, defaultRateToIRR: editingRate, updatedAt: '1404/08/12' } : c
    );
    onUpdateCurrencies(updated);
    setEditingCode(null);
  };

  const handleDeleteCurrency = (code: string) => {
    if (code === 'IRR' || code === 'USD') {
      alert('ارز پایه ریال و دلار قابل حذف نیستند.');
      return;
    }
    if (confirm(`آیا از حذف ارز ${code} اطمینان دارید؟`)) {
      onUpdateCurrencies(currencies.filter((c) => c.code !== code));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/30">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">مدیریت و تعریف انواع ارزها</h3>
              <p className="text-xs text-slate-400">
                تعریف ارز جدید (تتر، دلار کانادا، پوند، لیر، دینار...) و تنظیم نرخ روز
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* لیست ارزهای فعلی */}
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {currencies.map((c) => (
            <div
              key={c.code}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono-num font-bold rounded">
                  {c.code}
                </span>
                <div>
                  <span className="text-white font-bold block">{c.name}</span>
                  <span className="text-[10px] text-slate-500">
                    نماد: {c.symbol} | بروزرسانی: {c.updatedAt || 'امروز'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editingCode === c.code ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatNumber(editingRate)}
                      onChange={(e) => setEditingRate(parseFormattedNumber(e.target.value))}
                      className="w-28 bg-slate-900 border border-teal-500 rounded px-2 py-1 text-white font-mono-num text-xs"
                    />
                    <button
                      onClick={() => handleSaveEditRate(c.code)}
                      className="p-1 rounded bg-teal-500 text-slate-950 font-bold"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-teal-300 text-sm">
                      {c.isBase ? 'ارز پایه (۱)' : `${formatNumber(c.defaultRateToIRR)} ریال`}
                    </span>
                    {!c.isBase && (
                      <button
                        onClick={() => {
                          setEditingCode(c.code);
                          setEditingRate(c.defaultRateToIRR);
                        }}
                        className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {!c.isBase && c.code !== 'USD' && (
                  <button
                    onClick={() => handleDeleteCurrency(c.code)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* دکمه باز کردن فرم تعریف ارز جدید */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + تعریف ارز جدید (تتر، دلار کانادا، پوند، لیر، دینار و...)
          </button>
        ) : (
          <form
            onSubmit={handleAddCurrency}
            className="bg-slate-950 border border-teal-500/30 rounded-xl p-3.5 space-y-3"
          >
            <h4 className="text-xs font-bold text-teal-300">افزودن ارز جدید به سیستم</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">کد ارز (لاتین)</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="USDT / CAD"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white uppercase font-mono-num"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">نام فارسی ارز</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="تتر / دلار کانادا"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">نماد ارز</label>
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  placeholder="₮ / C$"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">نرخ اولیه به ریال</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newRate ? formatNumber(newRate) : ''}
                  onChange={(e) => setNewRate(parseFormattedNumber(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono-num"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                ذخیره ارز جدید
              </button>
            </div>
          </form>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-bold cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
