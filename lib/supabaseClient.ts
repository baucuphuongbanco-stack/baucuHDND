
import { createClient } from '@supabase/supabase-js';

// Hàm helper để lấy biến môi trường an toàn trên nhiều môi trường build khác nhau (Vite, Webpack, etc.)
const getEnvVar = (key: string) => {
  // 1. Ưu tiên import.meta.env (Vite standard)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // Thử lấy key gốc
    // @ts-ignore
    if (import.meta.env[key]) return import.meta.env[key];
    // Thử lấy key có prefix VITE_ (Vite bắt buộc prefix này để expose ra client)
    const viteKey = `VITE_${key.replace('REACT_APP_', '')}`;
    // @ts-ignore
    if (import.meta.env[viteKey]) return import.meta.env[viteKey];
  }

  // 2. Fallback sang process.env (Create React App / Webpack)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      if (process.env[key]) return process.env[key];
    }
  } catch (e) {
    // Bỏ qua lỗi nếu truy cập process thất bại
  }

  return undefined;
};

/**
 * Cấu hình kết nối Supabase
 * URL và Key cần được cấu hình trong file .env.local (khi dev) 
 * hoặc trong Environment Variables của Netlify (khi deploy)
 */
// Hỗ trợ cả key REACT_APP_ (cũ) và VITE_ (mới)
const SUPABASE_URL = getEnvVar('REACT_APP_SUPABASE_URL') || getEnvVar('SUPABASE_URL') || 'https://arjyhiagccrmbwqqgacc.supabase.co';
const SUPABASE_ANON_KEY = getEnvVar('REACT_APP_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY') || 'sb_publishable_WznwRibwYOJg_UglxXewfQ_EtFhNU-0';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Lỗi: Thiếu cấu hình Supabase URL hoặc Anon Key. Vui lòng kiểm tra biến môi trường.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper để lấy URL ảnh avatar từ storage
export const getStorageUrl = (path: string) => {
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`;
};
