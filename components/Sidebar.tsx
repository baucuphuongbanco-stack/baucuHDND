
import React from 'react';
import { PageType } from '../types';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  isOpen: boolean;
  onToggle: () => void;
  // Added missing isLargeText property
  isLargeText: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, isOpen, isLargeText }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard An Phú', icon: 'monitoring' },
    { id: 'candidates', label: 'Danh sách Ứng viên', icon: 'badge' },
    { id: 'voters', label: 'Cử tri Phường', icon: 'groups' },
    { id: 'data-entry', label: 'Nhập kết quả', icon: 'app_registration' },
    { id: 'calculation', label: 'Tổng hợp số liệu', icon: 'analytics' },
    { id: 'reports', label: 'Hồ sơ & Mẫu biểu', icon: 'file_open' },
    { id: 'accounts', label: 'Phân quyền', icon: 'shield_person' },
    { id: 'logs', label: 'Lịch sử Audit', icon: 'manage_history' },
    { id: 'design-system', label: 'Design System', icon: 'design_services' },
  ];

  return (
    <aside className={`${isOpen ? 'w-72' : 'w-0 lg:w-20'} flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-500 flex flex-col overflow-hidden z-50`}>
      <div className="p-6 flex items-center gap-4 border-b border-slate-50 dark:border-slate-800">
        <div className="bg-admin-red text-white p-2.5 rounded-xl flex-shrink-0 shadow-lg shadow-red-500/20">
          <span className="material-symbols-outlined text-2xl font-black">policy</span>
        </div>
        {isOpen && (
          <div className="flex flex-col whitespace-nowrap">
            <h1 className="text-slate-900 dark:text-white text-base font-black leading-none uppercase tracking-tighter">Phường An Phú</h1>
            <p className="text-slate-500 text-[10px] mt-1 font-bold uppercase tracking-widest">Hệ thống Bầu cử 2026</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 mt-8 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id as PageType)}
            className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all duration-300 group ${
              currentPage === item.id 
                ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${currentPage === item.id ? 'material-symbols-filled' : 'group-hover:scale-110 transition-transform'}`}>
              {item.icon}
            </span>
            {isOpen && <span className={`${isLargeText ? 'text-base' : 'text-sm'} font-bold whitespace-nowrap uppercase tracking-tight`}>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-auto p-6 bg-slate-50/50 dark:bg-slate-800/20">
        <div className={`flex items-center gap-3 ${isOpen ? 'px-1' : 'justify-center'}`}>
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-black border border-primary/20">
            AD
          </div>
          {isOpen && (
            <div className="flex flex-col whitespace-nowrap">
              <p className="text-xs font-black dark:text-white uppercase tracking-tighter">Ban Chỉ Đạo</p>
              <p className="text-[10px] text-emerald-500 font-bold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Đang trực tuyến
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};