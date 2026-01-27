-- ===================================================================
-- GIẢI PHÁP CUỐI CÙNG: Cấp quyền Admin cho user hiện tại
-- ===================================================================
-- Có 2 cách giải quyết, chọn 1 trong 2:

-- ===================================================================
-- CÁCH 1: Thay đổi vai trò của user hiện tại thành 'nhap_lieu'
-- ===================================================================
-- Chạy query này nếu bạn muốn đổi vai trò user sang "Nhập liệu"

UPDATE profiles 
SET role = 'nhap_lieu'
WHERE id = auth.uid();

-- Sau đó refresh lại trang web (Ctrl+Shift+R)

-- ===================================================================
-- CÁCH 2: Thêm vai trò hiện tại vào danh sách Admin
-- ===================================================================
-- Nếu vai trò hiện tại của bạn KHÔNG phải 'nhap_lieu',
-- hãy thay 'YOUR_CURRENT_ROLE' bên dưới bằng vai trò thực tế
-- (ví dụ: 'truc_tuyen', 'giam_sat', v.v.)

CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN (
        'super_admin', 
        'ban_chi_dao', 
        'admin_phuong', 
        'nhap_lieu',
        'YOUR_CURRENT_ROLE'  -- ⚠️ THAY ĐỔI DÒNG NÀY
    )
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload config';

-- ===================================================================
-- SAU KHI CHẠY, KIỂM TRA LẠI:
-- ===================================================================
SELECT 
    p.username,
    p.role,
    is_admin() as has_admin_access,
    (SELECT COUNT(*) FROM voters) as can_see_voters
FROM profiles p 
WHERE p.id = auth.uid();

-- Kết quả mong đợi:
-- - has_admin_access: true
-- - can_see_voters: 1614
