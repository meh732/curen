import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="bg-gradient-to-r from-teal-900/90 to-emerald-950/90 border-b border-teal-500/30 px-4 py-2.5 text-xs text-white flex items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
          <Smartphone className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold text-teal-200 block">نصب نرم‌افزار صرافی روی گوشی (PWA)</span>
          <span className="text-[11px] text-teal-300/80">
            جهت دسترسی آفلاین سریع، آیکون برنامه را به صفحه اصلی گوشی بیفزایید.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>نصب اپلیکیشن</span>
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="p-1 rounded text-teal-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
