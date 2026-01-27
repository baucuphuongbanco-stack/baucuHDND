import { supabase } from './supabaseClient';

export interface LogEntry {
    userName?: string;
    action: string;
    details?: string;
    status?: 'success' | 'error';
    ipAddress?: string;
}

/**
 * Ghi log hệ thống vào bảng system_logs
 */
export const createLog = async (entry: LogEntry) => {
    try {
        const { error } = await supabase.from('system_logs').insert([
            {
                user_name: entry.userName || 'System',
                action: entry.action,
                details: entry.details || '',
                ip_address: entry.ipAddress || 'internal',
                status: entry.status || 'success',
            }
        ]);

        if (error) {
            console.error('Lỗi khi ghi Audit Log:', error.message);
        }
    } catch (err) {
        console.error('Lỗi không xác định khi ghi Audit Log:', err);
    }
};
