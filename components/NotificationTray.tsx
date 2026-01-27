
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export const NotificationTray: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const trayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();

        const channel = supabase
            .channel('system-notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
                const newLog = payload.new;
                setNotifications(prev => [newLog, ...prev].slice(0, 10));
                if (!isOpen) setUnreadCount(c => c + 1);
            })
            .subscribe();

        const handleClickOutside = (event: MouseEvent) => {
            if (trayRef.current && !trayRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            supabase.removeChannel(channel);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const fetchNotifications = async () => {
        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (!error && data) {
            setNotifications(data);
        }
    };

    const toggleTray = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setUnreadCount(0);
    };

    return (
        <div className="relative" ref={trayRef}>
            <button
                onClick={toggleTray}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 relative hover:bg-slate-100 transition-all group"
            >
                <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-admin-red opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-admin-red border-2 border-white dark:border-slate-900 text-[8px] font-black text-white items-center justify-center">
                            {unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700 flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Thông báo hệ thống</h3>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded-full">MỚI NHẤT</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
                        {notifications.length === 0 ? (
                            <div className="p-10 text-center italic text-slate-400 text-xs text-balance">Chưa có thông báo nào mới</div>
                        ) : (
                            notifications.map((notif) => (
                                <div key={notif.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 size-2 rounded-full shrink-0 ${notif.status === 'success' ? 'bg-emerald-500' : 'bg-admin-red'}`}></div>
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase leading-tight">{notif.action}</p>
                                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-snug">{notif.details}</p>
                                            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase">
                                                {new Date(notif.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {notif.user_name}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700 text-center">
                        <button className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">Xem toàn bộ lịch sử</button>
                    </div>
                </div>
            )}
        </div>
    );
};
