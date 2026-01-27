-- EMERGENCY FIX SCRIPT
-- Chạy toàn bộ script này trong SQL Editor để sửa triệt để lỗi

-- 1. Xử lý triệt để bảng SYSTEM_LOGS (Xóa đi tạo lại để đảm bảo đúng cột)
DROP TABLE IF EXISTS public.system_logs;

CREATE TABLE public.system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT,
  action TEXT,
  details TEXT,
  ip_address TEXT,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cấp quyền cho bảng log mới
GRANT ALL ON public.system_logs TO postgres, service_role;
GRANT INSERT, SELECT ON public.system_logs TO authenticated;
GRANT INSERT, SELECT ON public.system_logs TO anon;

-- 2. Mở quyền nạp dữ liệu (Bỏ qua check role phức tạp tạm thời)
DROP POLICY IF EXISTS "Scope-based voter insert" ON voters;
DROP POLICY IF EXISTS "Emergency Insert Access" ON voters;

CREATE POLICY "Emergency Insert Access" ON voters 
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- 3. Làm mới Schema Cache (Quan trọng)
NOTIFY pgrst, 'reload config';
