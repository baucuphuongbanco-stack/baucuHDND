import React, { useState, useEffect } from 'react';
import { NotificationTray } from './NotificationTray';

interface HeaderProps {
  onToggleSidebar: () => void;
  onLogout?: () => void;
  isLargeText: boolean;
  setIsLargeText: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onLogout, isLargeText, setIsLargeText }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b-2 border-primary/20 px-6 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-6">
        <button onClick={onToggleSidebar} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <div className="flex items-center gap-4 border-l-2 border-slate-100 dark:border-slate-800 pl-6">
          <div className="size-10 bg-admin-red rounded-lg flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined text-2xl font-black italic">account_balance</span>
          </div>
          <div className="hidden md:block">
            <h2 className="text-slate-900 dark:text-white text-lg font-black tracking-tight uppercase leading-none">PHƯỜNG BÀN CỜ</h2>
            <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mt-1">HỆ THỐNG BẦU CỬ 2026</p>
          </div>
          {!isOnline && (
            <div className="ml-4 px-3 py-1 bg-amber-100 text-amber-700 text-[9px] font-black rounded-full border border-amber-200 animate-pulse flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">cloud_off</span>
              NGOẠI TUYẾN
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* FONT SIZE SELECTOR (A / A+) */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 mr-4">
          <button
            onClick={() => setIsLargeText(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${!isLargeText ? 'bg-white dark:bg-slate-600 text-primary shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'}`}
          >
            A
          </button>
          <button
            onClick={() => setIsLargeText(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-black transition-all ${isLargeText ? 'bg-white dark:bg-slate-600 text-primary shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'}`}
          >
            A+
          </button>
        </div>

        {/* NOTIFICATIONS */}
        <NotificationTray />

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

        {/* USER PROFILE */}
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-none">Lê Văn Thành</p>
            <p className="text-[9px] font-bold text-emerald-600 uppercase mt-1 tracking-widest flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Trực tuyến
            </p>
          </div>
          <div className="size-11 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-black text-sm shadow-inner overflow-hidden">
            <span className="material-symbols-outlined">person</span>
          </div>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-admin-red transition-colors ml-1">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
