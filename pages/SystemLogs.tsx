import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogEntry } from '../types';

interface SystemLogsProps {
  isLargeText?: boolean;
}

const ITEMS_PER_PAGE = 20;

export const SystemLogs: React.FC<SystemLogsProps> = ({ isLargeText }) => {
  // --- STATE ---
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(''); // YYYY-MM
  const [filterAction, setFilterAction] = useState('all');

  // --- INITIAL DATA & FETCHING ---
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Thử lấy dữ liệu từ bảng 'system_logs' trên Supabase
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Map dữ liệu từ DB
        const mappedLogs: LogEntry[] = data.map(item => ({
          id: item.id,
          time: new Date(item.created_at).toLocaleString('vi-VN'),
          user: item.user_name || 'Hệ thống',
          action: item.action,
          details: item.details,
          ip: item.ip_address || '---',
          status: item.status === 'error' ? 'failure' : 'success'
        }));
        setLogs(mappedLogs);
      } else {
        // Nếu lỗi hoặc rỗng, có thể để trống hoặc fallback (ở đây ta để trống nếu DB có bảng nhưng chưa có data)
        setLogs([]); 
      }
    } catch (err) {
      console.error('Lỗi tải logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleClearLogs = async () => {
    if (!window.confirm('CẢNH BÁO AN NINH QUAN TRỌNG:\n\nBạn có chắc chắn muốn XÓA TOÀN BỘ nhật ký hệ thống?\nHành động này không thể hoàn tác và sẽ xóa sạch lịch sử truy vết hoạt động.')) return;

    setLoading(true);
    try {
      // Xóa tất cả bản ghi (ID khác null-uuid)
      const { error } = await supabase
        .from('system_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      alert('Đã xóa toàn bộ nhật ký hệ thống thành công.');
      setLogs([]); 
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Lỗi xóa logs:', err);
      alert('Không thể xóa nhật ký: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FILTERING LOGIC ---
  const uniqueActions = useMemo(() => {
      const actions = new Set(logs.map(l => l.action));
      return Array.from(actions);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Search Text
      const searchContent = `${log.user} ${log.action} ${log.details} ${log.ip}`.toLowerCase();
      const matchSearch = searchContent.includes(searchTerm.toLowerCase());

      // 2. Filter Action
      const matchAction = filterAction === 'all' || log.action === filterAction;

      // 3. Filter Date (So sánh chuỗi hoặc Date object tùy format)
      // Log time format: "HH:mm:ss DD/MM/YYYY" hoặc "DD/MM/YYYY ..."
      let matchDate = true;
      if (filterDate) {
          const [year, month] = filterDate.split('-');
          const datePart = log.time.split(' ')[1] || log.time.split(' ')[0]; // lấy phần ngày
          if (datePart.includes('/')) {
             const [d, m, y] = datePart.split('/');
             matchDate = parseInt(m) === parseInt(month) && parseInt(y) === parseInt(year);
          }
      }

      return matchSearch && matchAction && matchDate;
    });
  }, [logs, searchTerm, filterAction, filterDate]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
      setCurrentPage(1); // Reset trang khi filter thay đổi
  }, [searchTerm, filterAction, filterDate]);

  // --- EXPORT FUNCTION ---
  const handleExport = () => {
    const headers = ['Thời gian', 'Người dùng', 'Hành động', 'Chi tiết', 'IP', 'Trạng thái'];
    const csvContent = [
        headers.join(','),
        ...filteredLogs.map(log => [
            `"${log.time}"`,
            `"${log.user}"`,
            `"${log.action}"`,
            `"${log.details}"`,
            `"${log.ip}"`,
            `"${log.status === 'success' ? 'Thành công' : 'Thất bại'}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `System_Logs_AnPhu_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const clearFilters = () => {
      setSearchTerm('');
      setFilterDate('');
      setFilterAction('all');
  };

  return (
    <div className={`space-y-6 pb-20 animate-in fade-in duration-500 ${isLargeText ? 'text-lg' : 'text-base'}`}>
      
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="space-y-1">
          <h1 className={`${isLargeText ? 'text-4xl' : 'text-3xl'} font-black text-slate-900 dark:text-white tracking-tight leading-tight uppercase`}>Nhật Ký Hệ Thống</h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Truy vết & Kiểm soát an ninh dữ liệu 24/7</p>
        </div>
        <div className="flex gap-3">
          <button 
             onClick={handleClearLogs} 
             className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">delete_forever</span>
            Xóa lịch sử
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95">
            <span className="material-symbols-outlined text-lg">download</span>
            Xuất Excel / CSV
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Tìm kiếm nhanh</label>
            <div className="relative h-12">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên, hành động, IP..." 
                className="w-full h-full pl-12 pr-4 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Tháng / Năm</label>
            <div className="relative h-12">
                <input 
                    type="month" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full h-full pl-4 pr-4 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all uppercase"
                />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Loại hành động</label>
            <select 
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
            >
              <option value="all">Tất cả hoạt động</option>
              {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchTerm || filterDate || filterAction !== 'all') && (
            <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mr-2">Đang lọc:</span>
            
            {filterAction !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg border border-primary/20">
                    {filterAction} <button onClick={() => setFilterAction('all')}><span className="material-symbols-outlined text-sm hover:text-red-500">close</span></button>
                </span>
            )}
            
            {filterDate && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg border border-primary/20">
                    {filterDate} <button onClick={() => setFilterDate('')}><span className="material-symbols-outlined text-sm hover:text-red-500">close</span></button>
                </span>
            )}

            {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg border border-primary/20">
                    Tìm: "{searchTerm}" <button onClick={() => setSearchTerm('')}><span className="material-symbols-outlined text-sm hover:text-red-500">close</span></button>
                </span>
            )}

            <button onClick={clearFilters} className="text-[10px] font-black text-admin-red hover:underline ml-auto uppercase tracking-widest">Xóa bộ lọc</button>
            </div>
        )}
      </div>

      {/* LOG TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-5">Thời gian</th>
                <th className="px-8 py-5">Cán bộ thực hiện</th>
                <th className="px-8 py-5">Hành động & Chi tiết</th>
                <th className="px-8 py-5 text-center">IP Nguồn</th>
                <th className="px-8 py-5 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                  <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400">
                          <span className="material-symbols-outlined text-4xl animate-spin mb-2">sync</span>
                          <p className="text-xs font-bold uppercase">Đang tải dữ liệu...</p>
                      </td>
                  </tr>
              ) : paginatedLogs.length === 0 ? (
                  <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400">
                          <span className="material-symbols-outlined text-4xl mb-2">find_in_page</span>
                          <p className="text-xs font-bold uppercase">Không tìm thấy nhật ký phù hợp</p>
                      </td>
                  </tr>
              ) : (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-8 py-5 whitespace-nowrap">
                        <p className={`font-black text-slate-900 dark:text-white leading-tight ${isLargeText ? 'text-base' : 'text-sm'}`}>{log.time.split(' ')[1]}</p>
                        <p className="text-[10px] font-bold text-slate-400 font-mono mt-1">{log.time.split(' ')[0]}</p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black uppercase shadow-sm">
                            {log.user.split(' ').pop()?.charAt(0)}
                          </div>
                          <div>
                             <span className={`block font-black text-slate-800 dark:text-slate-200 uppercase ${isLargeText ? 'text-base' : 'text-xs'}`}>{log.user}</span>
                             <span className="text-[9px] font-bold text-slate-400 uppercase">Cán bộ</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className={`font-black uppercase tracking-tight ${isLargeText ? 'text-base' : 'text-sm'} ${
                            log.action.includes('Khóa') || log.action.includes('Sửa') ? 'text-admin-red' : 
                            log.action.includes('Đăng nhập') ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {log.action}
                        </p>
                        {log.details && <p className="text-[10px] font-bold text-slate-500 mt-1 italic line-clamp-1">{log.details}</p>}
                      </td>
                      <td className="px-8 py-5 text-center">
                          <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-500">{log.ip}</span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        {log.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-emerald-50 text-emerald-700 uppercase border border-emerald-100">
                                <span className="material-symbols-outlined text-[10px]">check</span> Thành công
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-red-50 text-red-700 uppercase border border-red-100">
                                <span className="material-symbols-outlined text-[10px]">error</span> Thất bại
                            </span>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
            <div className="px-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Đang xem {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} 
                <span className="mx-1 text-slate-300">/</span> {filteredLogs.length} bản ghi
            </p>
            <div className="flex gap-2">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="size-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-900 text-slate-400 hover:text-primary disabled:opacity-50 transition-all"
                >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                
                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // Logic hiển thị số trang thông minh
                        let pageNum = i + 1;
                        if (totalPages > 5) {
                            if (currentPage > 3) pageNum = currentPage - 2 + i;
                            if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                        }
                        
                        return (
                            <button 
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`size-9 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                                    currentPage === pageNum 
                                    ? 'bg-primary text-white shadow-md transform scale-105' 
                                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="size-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-900 text-slate-400 hover:text-primary disabled:opacity-50 transition-all"
                >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
            </div>
            </div>
        )}
      </div>
    </div>
  );
};