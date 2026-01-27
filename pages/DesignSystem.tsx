
import React from 'react';

interface DesignSystemProps {
  isLargeText?: boolean;
}

export const DesignSystem: React.FC<DesignSystemProps> = ({ isLargeText }) => {
  return (
    <div className={`space-y-12 pb-20 ${isLargeText ? 'text-lg' : 'text-base'}`}>
      <div className="border-b-8 border-primary pb-8">
        <h1 className={`${isLargeText ? 'text-6xl' : 'text-5xl'} font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none`}>VED UI STANDARD 2026</h1>
        <p className={`${isLargeText ? 'text-2xl' : 'text-xl'} text-slate-600 font-bold mt-4 uppercase tracking-widest`}>Quy chuẩn Thiết kế Hành chính Số - Phường An Phú</p>
      </div>

      {/* Typography Section */}
      <section className="space-y-8">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter border-l-8 border-primary pl-6">Hệ thống Typography (Tối ưu cho cán bộ)</h3>
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border-2 border-slate-200 dark:border-slate-800 shadow-xl space-y-10">
          <div className="flex items-center gap-10">
            <div className="flex-1 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề cấp 1 (H1)</p>
              <h1 className={`${isLargeText ? 'text-5xl' : 'text-4xl'} font-black text-slate-900 uppercase leading-none`}>DANH SÁCH CỬ TRI</h1>
            </div>
            <p className="text-sm font-mono text-slate-400">24px - Black 900</p>
          </div>
          <div className="h-px bg-slate-100"></div>
          <div className="flex items-center gap-10">
            <div className="flex-1 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung chính (Bảng)</p>
              <p className={`${isLargeText ? 'text-2xl' : 'text-xl'} font-black text-slate-900 uppercase`}>NGUYỄN VĂN THÀNH</p>
            </div>
            <p className="text-sm font-mono text-slate-400">16px/20px - Black 900</p>
          </div>
          <div className="h-px bg-slate-100"></div>
          <div className="flex items-center gap-10">
            <div className="flex-1 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông tin bổ trợ</p>
              <p className={`${isLargeText ? 'text-lg' : 'text-base'} font-bold text-slate-500 uppercase`}>Số CCCD: 074188002452</p>
            </div>
            <p className="text-sm font-mono text-slate-400">14px - Bold 700</p>
          </div>
        </div>
      </section>

      {/* Buttons & Status */}
      <section className="space-y-8">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter border-l-8 border-primary pl-6">Nút bấm & Trạng thái</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-lg space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hành động chính</p>
              <div className="flex flex-wrap gap-4">
                <button className="px-10 py-5 bg-primary text-white text-sm font-black uppercase rounded-2xl shadow-xl shadow-primary/30">In Báo Cáo</button>
                <button className="px-10 py-5 bg-slate-900 text-white text-sm font-black uppercase rounded-2xl shadow-xl shadow-black/30">Xác Nhận</button>
              </div>
           </div>
           <div className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-lg space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhãn trạng thái (High Contrast)</p>
              <div className="flex flex-wrap gap-4">
                <span className="px-5 py-2 bg-emerald-100 text-emerald-800 border-2 border-emerald-200 text-sm font-black uppercase rounded-full">Thường trú</span>
                <span className="px-5 py-2 bg-red-100 text-red-800 border-2 border-red-200 text-sm font-black uppercase rounded-full">Đã chuyển đi</span>
              </div>
           </div>
        </div>
      </section>

      <div className="p-12 bg-primary/10 rounded-[3rem] border-4 border-dashed border-primary/30 text-center space-y-4">
        <span className="material-symbols-outlined text-7xl text-primary animate-bounce">verified</span>
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Tính tuân thủ Hành chính</h2>
        <p className="max-w-2xl mx-auto text-slate-600 text-lg font-bold leading-relaxed">
          Giao diện được tinh chỉnh để phục vụ tốt nhất cho cán bộ trong điều kiện ánh sáng văn phòng, giảm mỏi mắt khi làm việc với cường độ cao trong ngày bầu cử 2026.
        </p>
      </div>
    </div>
  );
};