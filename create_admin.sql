-- OPTION 1: NẾU BẠN CHƯA TẠO ĐƯỢC TÀI KHOẢN (Tạo mới)
DO $$
BEGIN
  PERFORM create_system_user(
    'admin@banco.com',       -- Email
    'banco123',              -- Mật khẩu MỚI
    'admin_banco',           -- Username
    'Quản trị viên Bàn Cờ',   -- Full Name
    'super_admin',           -- Role
    NULL, NULL, NULL, NULL,
    '{"ALL": true}'::jsonb
  );
END $$;


-- OPTION 2: NẾU BẠN ĐÃ LỠ TẠO VỚI PASSWORD CŨ (Đổi mật khẩu)
-- Chạy dòng này nếu Option 1 báo lỗi "Email đã tồn tại"
UPDATE auth.users
SET encrypted_password = crypt('banco123', gen_salt('bf'))
WHERE email = 'admin@banco.com';
